import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const prefsSchema = z.object({
  emailMarketing: z.boolean().optional(),
  emailNewsletter: z.boolean().optional(),
  emailComments: z.boolean().optional(),
  emailPublish: z.boolean().optional(),
  emailBilling: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  pushComments: z.boolean().optional(),
  pushPublish: z.boolean().optional(),
});

// GET /api/user/notifications — 현재 알림 설정 조회
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPrefs: true },
    });

    // notificationPrefs가 없으면 기본값 반환
    const defaultPrefs = {
      emailMarketing: false,
      emailNewsletter: true,
      emailComments: true,
      emailPublish: true,
      emailBilling: true,
      pushEnabled: false,
      pushComments: true,
      pushPublish: true,
    };

    const prefs = user?.notificationPrefs
      ? (JSON.parse(user.notificationPrefs as string) as typeof defaultPrefs)
      : defaultPrefs;

    return NextResponse.json({ preferences: { ...defaultPrefs, ...prefs } });
  } catch (error) {
    console.error("Get notification prefs error:", error);
    return NextResponse.json({ error: "오류가 발생했습니다." }, { status: 500 });
  }
}

// PATCH /api/user/notifications — 알림 설정 저장
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const preferences = prefsSchema.parse(body);

    // 현재 설정을 가져와서 병합 후 저장
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPrefs: true },
    });
    const existing = user?.notificationPrefs
      ? JSON.parse(user.notificationPrefs as string)
      : {};

    await prisma.user.update({
      where: { id: session.user.id },
      data: { notificationPrefs: JSON.stringify({ ...existing, ...preferences }) },
    });

    return NextResponse.json({ success: true, message: "알림 설정이 저장되었습니다." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Save notification prefs error:", error);
    return NextResponse.json({ error: "오류가 발생했습니다." }, { status: 500 });
  }
}

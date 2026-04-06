import { AppLayout } from "@/components/layouts/app-layout";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AppAreaLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // 사용자 정보 조회
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      plan: true,
      creditsUsed: true,
      creditsTotal: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <AppLayout
      usage={{
        used: user.creditsUsed,
        total: user.creditsTotal,
        planName: user.plan,
      }}
    >
      {children}
    </AppLayout>
  );
}

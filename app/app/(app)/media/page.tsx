import { Metadata } from "next";
import MediaClient from "./media-client";

export const metadata: Metadata = {
  title: "미디어 라이브러리 | FlowPack",
  description: "이미지, 오디오 파일을 한 곳에서 업로드하고 관리하세요.",
};

export default function MediaPage() {
  return <MediaClient />;
}

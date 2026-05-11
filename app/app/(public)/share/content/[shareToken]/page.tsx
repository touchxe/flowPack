import { PublicContentReview } from "@/components/features/content/public-content-review";

interface PublicContentViewPageProps {
  params: Promise<{ shareToken: string }>;
}

export default async function PublicContentViewPage({
  params,
}: PublicContentViewPageProps): Promise<React.ReactElement> {
  const { shareToken } = await params;

  return <PublicContentReview shareToken={shareToken} />;
}


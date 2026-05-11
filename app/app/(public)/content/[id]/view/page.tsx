import { PublicContentReview } from "@/components/features/content/public-content-review";

interface PublicContentViewPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function PublicContentViewPage({
  searchParams,
}: PublicContentViewPageProps): Promise<React.ReactElement> {
  const { token } = await searchParams;

  return <PublicContentReview shareToken={token ?? ""} />;
}

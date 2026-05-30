import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { RecipeDetail } from '@/components/recipes/RecipeDetail';

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthenticatedLayout>
      <RecipeDetail recipeId={id} />
    </AuthenticatedLayout>
  );
}

import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { Container } from '@mui/material';
import { RecipeDetail } from '@/components/recipes/RecipeDetail';

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthenticatedLayout>
      {/* Container supplies the horizontal gutters (AuthenticatedLayout's <main> only pads
          vertically). Matches this route's loading.tsx / error.tsx skeletons. */}
      <Container maxWidth="xl">
        <RecipeDetail recipeId={id} />
      </Container>
    </AuthenticatedLayout>
  );
}

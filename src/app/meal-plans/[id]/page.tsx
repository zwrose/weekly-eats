import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { PlanDetail } from '@/components/meal-plans/PlanDetail';

export default async function MealPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthenticatedLayout>
      <PlanDetail planId={id} />
    </AuthenticatedLayout>
  );
}

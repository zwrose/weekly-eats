import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { TemplateSettings } from '@/components/meal-plans/TemplateSettings';

export default function MealPlanTemplatePage() {
  return (
    <AuthenticatedLayout>
      <TemplateSettings />
    </AuthenticatedLayout>
  );
}

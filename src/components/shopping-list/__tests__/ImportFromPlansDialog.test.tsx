import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ImportFromPlansDialog, type ImportPlanOption } from '../ImportFromPlansDialog';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

const PLANS: ImportPlanOption[] = [
  { _id: 'mp-1', name: 'Week of June 1', startDate: '2026-06-01' },
  { _id: 'mp-2', name: 'Week of June 8', startDate: '2026-06-08' },
];

function Harness({ onImport }: { onImport: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <ImportFromPlansDialog
      open
      plans={PLANS}
      selectedIds={selected}
      onToggle={(id) =>
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
      }
      onImport={() => onImport(selected)}
      onClose={() => {}}
    />
  );
}

describe('ImportFromPlansDialog', () => {
  it('renders the available plans and disables Add Items until one is selected', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    renderWithTheme(<Harness onImport={onImport} />);

    expect(screen.getByText('Week of June 1')).toBeInTheDocument();
    expect(screen.getByText('Week of June 8')).toBeInTheDocument();

    const addButton = screen.getByRole('button', { name: /^add items$/i });
    expect(addButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Week of June 1' }));
    expect(addButton).not.toBeDisabled();

    await user.click(addButton);
    expect(onImport).toHaveBeenCalledWith(['mp-1']);
  });

  it('shows an empty-state message when there are no plans', () => {
    renderWithTheme(
      <ImportFromPlansDialog
        open
        plans={[]}
        selectedIds={[]}
        onToggle={() => {}}
        onImport={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/no meal plans available/i)).toBeInTheDocument();
  });
});

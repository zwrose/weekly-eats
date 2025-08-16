import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import IngredientGroup from '../IngredientGroup';

describe('IngredientGroup', () => {
  it('renders with default props', () => {
    const onChange = vi.fn();
    const group = {
      title: '',
      ingredients: []
    };
    render(
      <IngredientGroup
        group={group}
        onChange={onChange}
      />
    );
    
    // Should show the group title field and "Add Ingredient" button
    expect(screen.getByPlaceholderText('Group title (required)')).toBeInTheDocument();
    expect(screen.getByText('Add Ingredient')).toBeInTheDocument();
    expect(screen.getByText('No ingredients in this group. Click "Add Ingredient" to get started.')).toBeInTheDocument();
  });

  it('renders with custom text props', () => {
    const onChange = vi.fn();
    const group = {
      title: 'Test Group',
      ingredients: []
    };
    render(
      <IngredientGroup
        group={group}
        onChange={onChange}
        addIngredientButtonText="Add Meal Item"
        emptyGroupText="No items in this group"
        removeIngredientButtonText="Remove Meal Item"
      />
    );
    
    // Should show the group title field with the provided title
    expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
    // Should show the custom "Add Meal Item" button
    expect(screen.getByText('Add Meal Item')).toBeInTheDocument();
    // The custom empty text should be displayed
    expect(screen.getByText('No items in this group')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import IngredientGroup from '../IngredientGroup';

describe('IngredientGroup', () => {
  afterEach(() => {
    cleanup();
  });
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

  it('shows both inline and bottom delete buttons (responsive design)', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    const group = {
      title: 'Test Group',
      ingredients: []
    };
    
    render(
      <IngredientGroup
        group={group}
        onChange={onChange}
        onRemove={onRemove}
        showRemoveButton={true}
      />
    );
    
    // Should show both delete buttons (responsive design)
    const deleteIcons = screen.getAllByTestId('DeleteIcon');
    expect(deleteIcons).toHaveLength(2); // One for inline, one for bottom button
    
    // Should show the bottom delete button with text
    const bottomDeleteButton = screen.getByText('Remove Group');
    expect(bottomDeleteButton).toBeInTheDocument();
    
    // Click the bottom delete button
    fireEvent.click(bottomDeleteButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('handles delete button clicks correctly', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    const group = {
      title: 'Test Group',
      ingredients: []
    };
    
    render(
      <IngredientGroup
        group={group}
        onChange={onChange}
        onRemove={onRemove}
        showRemoveButton={true}
      />
    );
    
    // Should show the bottom delete button with text
    const bottomDeleteButton = screen.getByText('Remove Group');
    expect(bottomDeleteButton).toBeInTheDocument();
    
    // Click the bottom delete button
    fireEvent.click(bottomDeleteButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not show delete button when showRemoveButton is false', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    const group = {
      title: 'Test Group',
      ingredients: []
    };
    
    render(
      <IngredientGroup
        group={group}
        onChange={onChange}
        onRemove={onRemove}
        showRemoveButton={false}
      />
    );
    
    // Should not show any delete buttons
    expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove Group')).not.toBeInTheDocument();
  });

  it('does not show delete button when onRemove is not provided', () => {
    const onChange = vi.fn();
    const group = {
      title: 'Test Group',
      ingredients: []
    };
    
    render(
      <IngredientGroup
        group={group}
        onChange={onChange}
        showRemoveButton={true}
      />
    );
    
    // Should not show any delete buttons
    expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove Group')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RecipeIngredients from '../RecipeIngredients';
import { RecipeIngredient } from '../../types/recipe';

describe('RecipeIngredients', () => {
  const defaultProps = {
    ingredients: [],
    onChange: vi.fn(),
    foodItems: [],
    onFoodItemAdded: vi.fn(),
  };

  afterEach(() => {
    cleanup();
  });

  it('renders empty state with add ingredient button', () => {
    render(<RecipeIngredients {...defaultProps} />);
    
    expect(screen.getByText('Add Ingredient')).toBeInTheDocument();
    expect(screen.getByText('No ingredients added yet. Click "Add Ingredient" to get started.')).toBeInTheDocument();
  });

  it('renders standalone mode with ingredients', () => {
    const ingredients = [{
      title: '',
      ingredients: [
        { type: 'foodItem' as const, id: '1', quantity: 2, unit: 'cup' },
        { type: 'foodItem' as const, id: '2', quantity: 1, unit: 'tbsp' }
      ],
      isStandalone: true
    }];

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    expect(screen.getByText('Convert to Groups')).toBeInTheDocument();
    expect(screen.queryByText('Add Ingredient Group')).not.toBeInTheDocument();
  });

  it('renders group mode with multiple groups', () => {
    const ingredients = [
      {
        title: 'Group 1',
        ingredients: [{ type: 'foodItem' as const, id: '1', quantity: 2, unit: 'cup' }]
      },
      {
        title: 'Group 2',
        ingredients: [{ type: 'foodItem' as const, id: '2', quantity: 1, unit: 'tbsp' }]
      }
    ];

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    expect(screen.getByText('Add Ingredient Group')).toBeInTheDocument();
    expect(screen.queryByText('Convert to Groups')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Group 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Group 2')).toBeInTheDocument();
  });

  it('calls onChange when add ingredient button is clicked in empty state', () => {
    render(<RecipeIngredients {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Add Ingredient'));
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([{
      title: '',
      ingredients: [],
      isStandalone: true
    }]);
  });

  it('calls onChange when convert to groups button is clicked with ingredients', () => {
    const ingredients = [{
      title: '',
      ingredients: [
        { type: 'foodItem' as const, id: '1', quantity: 2, unit: 'cup' },
        { type: 'foodItem' as const, id: '2', quantity: 1, unit: 'tbsp' }
      ],
      isStandalone: true
    }];

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    fireEvent.click(screen.getByText('Convert to Groups'));
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { title: 'Group 1', ingredients: [{ type: 'foodItem', id: '1', quantity: 2, unit: 'cup' }] },
      { title: 'Group 2', ingredients: [{ type: 'foodItem', id: '2', quantity: 1, unit: 'tbsp' }] }
    ]);
  });

  it('calls onChange when convert to groups button is clicked without ingredients', () => {
    const ingredients = [{
      title: '',
      ingredients: [],
      isStandalone: true
    }];

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    fireEvent.click(screen.getByText('Convert to Groups'));
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([{
      title: '',
      ingredients: []
    }]);
  });

  it('calls onChange when add ingredient group button is clicked', () => {
    const ingredients = [
      {
        title: 'Group 1',
        ingredients: [{ type: 'foodItem' as const, id: '1', quantity: 2, unit: 'cup' } as RecipeIngredient]
      }
    ];

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    fireEvent.click(screen.getByText('Add Ingredient Group'));
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      {
        title: 'Group 1',
        ingredients: [{ type: 'foodItem', id: '1', quantity: 2, unit: 'cup' }]
      },
      {
        title: '',
        ingredients: []
      }
    ]);
  });

  it('renders with custom text props', () => {
    const customProps = {
      ...defaultProps,
      addIngredientButtonText: 'Add Meal Item',
      addIngredientGroupButtonText: 'Add Meal Group',
      emptyGroupText: 'No items in this group',
      emptyNoGroupsText: 'No items added yet',
      removeIngredientButtonText: 'Remove Meal Item'
    };

    render(<RecipeIngredients {...customProps} />);
    
    expect(screen.getByText('Add Meal Item')).toBeInTheDocument();
    expect(screen.getByText('No items added yet')).toBeInTheDocument();
  });

  it('shows error state when group title is empty', () => {
    const ingredients = [
      {
        title: '',
        ingredients: [{ type: 'foodItem' as const, id: '1', quantity: 2, unit: 'cup' }]
      }
    ] as any;

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    expect(screen.getByText('Group title is required')).toBeInTheDocument();
  });

  it('does not show error state when group title is filled', () => {
    const ingredients = [
      {
        title: 'Valid Group',
        ingredients: [{ type: 'foodItem', id: '1', quantity: 2, unit: 'cup' }]
      }
    ] as any;

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    expect(screen.queryByText('Group title is required')).not.toBeInTheDocument();
  });

  it('handles group title change', () => {
    const ingredients = [
      {
        title: 'Original Title',
        ingredients: [{ type: 'foodItem', id: '1', quantity: 2, unit: 'cup' }]
      }
    ] as any;

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([{
      title: 'New Title',
      ingredients: [{ type: 'foodItem', id: '1', quantity: 2, unit: 'cup' }]
    }]);
  });

  it('handles removing a group', () => {
    const ingredients = [
      {
        title: 'Group 1',
        ingredients: [{ type: 'foodItem', id: '1', quantity: 2, unit: 'cup' }]
      },
      {
        title: 'Group 2',
        ingredients: [{ type: 'foodItem', id: '2', quantity: 1, unit: 'tbsp' }]
      }
    ] as any;

    render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    const deleteButtons = screen.getAllByText('Remove Group');
    fireEvent.click(deleteButtons[0]); // Remove first group
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      {
        title: 'Group 2',
        ingredients: [{ type: 'foodItem', id: '2', quantity: 1, unit: 'tbsp' }]
      }
    ]);
  });

  it('renders ingredient groups with responsive delete buttons', () => {
    const ingredients = [
      {
        title: 'Test Group',
        ingredients: [{ type: 'foodItem', id: '1', quantity: 2, unit: 'cup' }]
      }
    ] as any;

    const { unmount } = render(<RecipeIngredients {...defaultProps} ingredients={ingredients} />);
    
    // Should show both inline and bottom delete buttons (responsive design)
    const deleteIcons = screen.getAllByTestId('DeleteIcon');
    expect(deleteIcons.length).toBeGreaterThan(0);
    
    // Should show the bottom delete button(s) with text
    const bottomDeleteButtons = screen.getAllByText('Remove Group');
    expect(bottomDeleteButtons.length).toBeGreaterThan(0);
    expect(bottomDeleteButtons[0]).toBeInTheDocument();
    
    unmount();
  });
});

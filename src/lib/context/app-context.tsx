"use client";

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Define the app state structure
interface AppState {
  notifications: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
  }>;
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
}

// Define action types
type AppAction = 
  | { type: 'ADD_NOTIFICATION'; payload: Omit<AppState['notifications'][0], 'id'> }
  | { type: 'REMOVE_NOTIFICATION'; payload: { id: string } }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; payload: AppState['theme'] };

// Initial state
const initialState: AppState = {
  notifications: [],
  sidebarOpen: false,
  theme: 'system'
};

// Reducer function
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [
          ...state.notifications,
          {
            ...action.payload,
            id: Date.now().toString()
          }
        ]
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload.id)
      };
    
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebarOpen: !state.sidebarOpen
      };
    
    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload
      };
    
    default:
      return state;
  }
};

// Create context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;
  toggleSidebar: () => void;
  setTheme: (theme: AppState['theme']) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const addNotification = (notification: Omit<AppState['notifications'][0], 'id'>) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  };

  const removeNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: { id } });
  };

  const toggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  };

  const setTheme = (theme: AppState['theme']) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  const value: AppContextType = {
    state,
    dispatch,
    addNotification,
    removeNotification,
    toggleSidebar,
    setTheme
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}; 
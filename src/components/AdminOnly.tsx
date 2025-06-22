'use client';

import { useSession } from 'next-auth/react';
import { ReactNode } from 'react';

interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const AdminOnly = ({ children, fallback = null }: AdminOnlyProps) => {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  if (!isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}; 
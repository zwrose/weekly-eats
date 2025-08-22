import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export const useApprovalStatus = () => {
  const { data: session, update } = useSession();
  const router = useRouter();
  const sessionRef = useRef(session);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Update ref when session changes
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Listen for approval status changes via Server-Sent Events
  useEffect(() => {
    if (!session?.user?.email || isRedirecting) return;

    const eventSource = new EventSource('/api/user/approval-status/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const currentSession = sessionRef.current;
        const currentApproved = (currentSession?.user as { isApproved?: boolean })?.isApproved;
        const currentIsAdmin = (currentSession?.user as { isAdmin?: boolean })?.isAdmin;
        
        // If user gets approved and is on pending-approval page, redirect to home
        if (!currentApproved && data.isApproved && !currentIsAdmin) {
          setIsRedirecting(true);
          eventSource.close();
          setTimeout(() => {
            update({ isApproved: true }).then(() => {
              router.push('/meal-plans');
            });
          }, 100);
        }
        
        // If approval status changed from approved to not approved, redirect to pending approval
        if (currentApproved && !data.isApproved && !currentIsAdmin) {
          setIsRedirecting(true);
          eventSource.close();
          setTimeout(() => {
            update({ isApproved: false }).then(() => {
              router.push('/pending-approval');
            });
          }, 100);
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [session?.user?.email, router, update, isRedirecting]);

  return { isRedirecting };
}; 
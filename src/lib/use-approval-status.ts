import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export const useApprovalStatus = () => {
  const { data: session, update } = useSession();
  const router = useRouter();
  const sessionRef = useRef(session);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Update ref when session changes
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Poll for approval status changes every 30 seconds
  useEffect(() => {
    if (!session?.user?.email || isRedirecting) return;

    let isCancelled = false;

    const checkApprovalStatus = async () => {
      try {
        const response = await fetch("/api/user/approval-status", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return;
        }

        const data: { isApproved: boolean; isAdmin: boolean } =
          await response.json();
        if (isCancelled) return;

        const currentSession = sessionRef.current;
        const currentApproved = (
          currentSession?.user as { isApproved?: boolean }
        )?.isApproved;
        const currentIsAdmin = (currentSession?.user as { isAdmin?: boolean })
          ?.isAdmin;

        // If user gets approved and is on pending-approval page, redirect to meal plans
        if (!currentApproved && data.isApproved && !currentIsAdmin) {
          setIsRedirecting(true);
          setTimeout(() => {
            update({ isApproved: true }).then(() => {
              router.push("/meal-plans");
            });
          }, 100);
        }

        // If approval status changed from approved to not approved, redirect to pending approval
        if (currentApproved && !data.isApproved && !currentIsAdmin) {
          setIsRedirecting(true);
          setTimeout(() => {
            update({ isApproved: false }).then(() => {
              router.push("/pending-approval");
            });
          }, 100);
        }
      } catch (error) {
        console.error("Error polling approval status:", error);
      }
    };

    // Initial check
    void checkApprovalStatus();

    // Poll every 60 seconds
    const intervalId = setInterval(() => {
      void checkApprovalStatus();
    }, 60000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [session?.user?.email, router, update, isRedirecting]);

  return { isRedirecting };
};

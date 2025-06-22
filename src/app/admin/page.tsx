"use client";

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { 
  Box, 
  Typography, 
  Paper, 
  Container, 
  CircularProgress,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Search, 
  AdminPanelSettings, 
  Person,
  CheckCircle,
  Cancel,
  HourglassEmpty
} from '@mui/icons-material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import { useState, useEffect, useCallback } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isApproved: boolean;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: User | null;
    action: 'grant' | 'revoke' | 'approve' | 'deny' | 'revoke-approval';
  }>({
    open: false,
    user: null,
    action: 'grant'
  });
  const [activeTab, setActiveTab] = useState(0);

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setUsers([]);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(term.trim())}`);
      if (!response.ok) throw new Error('Failed to search users');
      
      const data = await response.json();
      setUsers(data.users);
    } catch {
      setMessage({ type: 'error', text: 'Failed to search users' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingUsers = useCallback(async () => {
    setPendingLoading(true);
    try {
      const response = await fetch('/api/admin/users/pending');
      if (!response.ok) throw new Error('Failed to fetch pending users');
      
      const data = await response.json();
      setPendingUsers(data.users);
    } catch {
      setMessage({ type: 'error', text: 'Failed to fetch pending users' });
    } finally {
      setPendingLoading(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchTerm, performSearch]);

  // Fetch pending users on mount
  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Check admin status from session
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  if (!isAdmin) {
    redirect('/');
  }

  const handleSearch = () => {
    performSearch(searchTerm);
  };

  const handleToggleAdmin = async (userId: string, currentAdminStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/users/toggle-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isAdmin: !currentAdminStatus }),
      });

      if (!response.ok) throw new Error('Failed to update admin status');

      // Update local state
      setUsers(users.map(user => 
        user._id === userId 
          ? { ...user, isAdmin: !currentAdminStatus }
          : user
      ));

      setMessage({ 
        type: 'success', 
        text: `Admin status ${!currentAdminStatus ? 'granted' : 'revoked'} successfully` 
      });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update admin status' });
    }
  };

  const handleApproval = async (userId: string, approved: boolean) => {
    try {
      const response = await fetch('/api/admin/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approved }),
      });

      if (!response.ok) throw new Error('Failed to update approval status');

      if (approved) {
        // If approving, remove from pending users
        setPendingUsers(pendingUsers.filter(user => user._id !== userId));
      } else {
        // If revoking approval, remove from search results (since only approved users are shown)
        setUsers(users.filter(user => user._id !== userId));
        // Also remove from pending users if they were there
        setPendingUsers(pendingUsers.filter(user => user._id !== userId));
      }

      setMessage({ 
        type: 'success', 
        text: `User ${approved ? 'approved' : 'denied'} successfully` 
      });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update approval status' });
    }
  };

  const openConfirmDialog = (user: User, action: 'grant' | 'revoke' | 'approve' | 'deny' | 'revoke-approval') => {
    setConfirmDialog({
      open: true,
      user,
      action
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      user: null,
      action: 'grant'
    });
  };

  const confirmAction = async () => {
    if (!confirmDialog.user) return;
    
    if (confirmDialog.action === 'approve') {
      await handleApproval(confirmDialog.user._id, true);
    } else if (confirmDialog.action === 'deny') {
      await handleApproval(confirmDialog.user._id, false);
    } else if (confirmDialog.action === 'revoke-approval') {
      await handleApproval(confirmDialog.user._id, false);
    } else {
      await handleToggleAdmin(confirmDialog.user._id, confirmDialog.user.isAdmin);
    }
    
    closeConfirmDialog();
  };

  const isCurrentUser = (userId: string) => {
    return session?.user?.email && users.find(u => u._id === userId)?.email === session.user.email;
  };

  const getDialogTitle = () => {
    switch (confirmDialog.action) {
      case 'grant': return 'Grant Admin Access';
      case 'revoke': return 'Revoke Admin Access';
      case 'approve': return 'Approve User';
      case 'deny': return 'Deny User';
      case 'revoke-approval': return 'Revoke Approval';
      default: return 'Confirm Action';
    }
  };

  const getDialogContent = () => {
    const user = confirmDialog.user;
    if (!user) return '';

    switch (confirmDialog.action) {
      case 'grant':
        return `Are you sure you want to grant admin access for ${user.name} (${user.email})? This user will have full administrative privileges.`;
      case 'revoke':
        return `Are you sure you want to revoke admin access for ${user.name} (${user.email})? This user will lose administrative privileges.`;
      case 'approve':
        return `Are you sure you want to approve ${user.name} (${user.email})? This user will gain access to all application features.`;
      case 'deny':
        return `Are you sure you want to deny ${user.name} (${user.email})? This user will not be able to access the application.`;
      case 'revoke-approval':
        return `Are you sure you want to revoke approval for ${user.name} (${user.email})? This user will lose access to all application features.`;
      default:
        return '';
    }
  };

  return (
    <AuthenticatedLayout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          User Management
        </Typography>
        
        <Paper sx={{ p: 3, mt: 3 }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HourglassEmpty fontSize="small" />
                  Pending Approval ({pendingUsers.length})
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Search fontSize="small" />
                  Search Users
                </Box>
              } 
            />
          </Tabs>

          {/* Pending Users Tab */}
          {activeTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Users Pending Approval
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={fetchPendingUsers}
                  disabled={pendingLoading}
                  startIcon={pendingLoading ? <CircularProgress size={16} /> : null}
                >
                  {pendingLoading ? 'Refreshing...' : 'Refresh'}
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Review and approve or deny new user registrations.
              </Typography>

              {pendingLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : pendingUsers.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Registration Date</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingUsers.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Person color="action" fontSize="small" />
                              {user.name}
                            </Box>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>Recent</TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              <Button
                                variant="outlined"
                                size="small"
                                color="success"
                                startIcon={<CheckCircle />}
                                onClick={() => openConfirmDialog(user, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                startIcon={<Cancel />}
                                onClick={() => openConfirmDialog(user, 'deny')}
                              >
                                Deny
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    No users pending approval
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Search Users Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Search Users
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Search for approved users by name or email to manage their admin status.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                  fullWidth
                  label="Search by name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter name or email..."
                  autoComplete="off"
                />
                <Button
                  variant="contained"
                  onClick={handleSearch}
                  disabled={loading}
                  startIcon={<Search />}
                  sx={{ minWidth: 120 }}
                >
                  {loading ? <CircularProgress size={20} /> : 'Search'}
                </Button>
              </Box>

              {users.length > 0 && (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Admin Status</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {user.isAdmin ? (
                                <AdminPanelSettings color="primary" fontSize="small" />
                              ) : (
                                <Person color="action" fontSize="small" />
                              )}
                              {user.name}
                            </Box>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={user.isAdmin ? 'Admin' : 'User'}
                              color={user.isAdmin ? 'primary' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            {!isCurrentUser(user._id) ? (
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => openConfirmDialog(user, user.isAdmin ? 'revoke' : 'grant')}
                                  color={user.isAdmin ? 'error' : 'primary'}
                                >
                                  {user.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color="warning"
                                  onClick={() => openConfirmDialog(user, 'revoke-approval')}
                                >
                                  Revoke Approval
                                </Button>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                Current user
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {users.length === 0 && searchTerm && !loading && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    No users found matching &quot;{searchTerm}&quot;
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Paper>

        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog.open}
          onClose={closeConfirmDialog}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            {getDialogTitle()}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {getDialogContent()}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeConfirmDialog} color="primary">
              Cancel
            </Button>
            <Button 
              onClick={confirmAction} 
              color={confirmDialog.action === 'deny' || confirmDialog.action === 'revoke' || confirmDialog.action === 'revoke-approval' ? 'error' : 'primary'}
              variant="contained"
              autoFocus
            >
              {confirmDialog.action === 'grant' ? 'Grant Admin' : 
               confirmDialog.action === 'revoke' ? 'Revoke Admin' :
               confirmDialog.action === 'approve' ? 'Approve' :
               confirmDialog.action === 'revoke-approval' ? 'Revoke Approval' : 'Deny'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!message}
          autoHideDuration={6000}
          onClose={() => setMessage(null)}
        >
          <Alert 
            onClose={() => setMessage(null)} 
            severity={message?.type} 
            sx={{ width: '100%' }}
          >
            {message?.text}
          </Alert>
        </Snackbar>
      </Container>
    </AuthenticatedLayout>
  );
} 
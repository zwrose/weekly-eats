"use client";

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Pagination,
  Alert
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  AdminPanelSettings,
  Person,
  HourglassEmpty
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';

interface User {
  _id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isApproved: boolean;
}

interface ConfirmDialog {
  open: boolean;
  user: User | null;
  action: 'grant' | 'revoke' | 'approve' | 'deny' | 'revoke-access';
}

export default function UserManagementPage() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    open: false,
    user: null,
    action: 'approve'
  });

  // Pagination state
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const pendingUsersPerPage = 5;
  const approvedUsersPerPage = 25;

  // Filter users based on search term
  const filteredPendingUsers = pendingUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredApprovedUsers = approvedUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate users
  const pendingUsersStartIndex = (pendingPage - 1) * pendingUsersPerPage;
  const pendingUsersEndIndex = pendingUsersStartIndex + pendingUsersPerPage;
  const paginatedPendingUsers = filteredPendingUsers.slice(pendingUsersStartIndex, pendingUsersEndIndex);

  const approvedUsersStartIndex = (approvedPage - 1) * approvedUsersPerPage;
  const approvedUsersEndIndex = approvedUsersStartIndex + approvedUsersPerPage;
  const paginatedApprovedUsers = filteredApprovedUsers.slice(approvedUsersStartIndex, approvedUsersEndIndex);

  const fetchPendingUsers = async () => {
    try {
      setPendingLoading(true);
      const response = await fetch('/api/admin/users/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchApprovedUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setApprovedUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching approved users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
    fetchApprovedUsers();
  }, []);

  // Reset pagination when search term changes
  useEffect(() => {
    setPendingPage(1);
    setApprovedPage(1);
  }, [searchTerm]);

  const handleToggleAdmin = async (userId: string, currentAdminStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/users/toggle-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          isAdmin: !currentAdminStatus,
        }),
      });

      if (response.ok) {
        // Refresh both user lists
        fetchPendingUsers();
        fetchApprovedUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update admin status');
      }
    } catch (error) {
      console.error('Error toggling admin status:', error);
      alert('Failed to update admin status');
    }
  };

  const handleApproval = async (userId: string, approved: boolean) => {
    try {
      const response = await fetch('/api/admin/users/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          approved,
        }),
      });

      if (response.ok) {
        // Refresh both user lists
        fetchPendingUsers();
        fetchApprovedUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update approval status');
      }
    } catch (error) {
      console.error('Error updating approval status:', error);
      alert('Failed to update approval status');
    }
  };

  const openConfirmDialog = (user: User, action: 'grant' | 'revoke' | 'approve' | 'deny' | 'revoke-access') => {
    setConfirmDialog({ open: true, user, action });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, user: null, action: 'approve' });
  };

  const confirmAction = async () => {
    if (!confirmDialog.user) return;

    if (confirmDialog.action === 'approve') {
      await handleApproval(confirmDialog.user._id, true);
    } else if (confirmDialog.action === 'deny') {
      await handleApproval(confirmDialog.user._id, false);
    } else if (confirmDialog.action === 'revoke-access') {
      await handleApproval(confirmDialog.user._id, false);
    } else {
      await handleToggleAdmin(confirmDialog.user._id, confirmDialog.user.isAdmin);
    }
    
    closeConfirmDialog();
  };

  const isCurrentUser = (userId: string) => {
    return session?.user?.email && [...pendingUsers, ...approvedUsers].find(u => u._id === userId)?.email === session.user.email;
  };

  const getDialogTitle = () => {
    switch (confirmDialog.action) {
      case 'grant': return 'Grant Admin Access';
      case 'revoke': return 'Revoke Admin Access';
      case 'approve': return 'Approve User';
      case 'deny': return 'Deny User';
      case 'revoke-access': return 'Revoke Access';
      default: return 'Confirm Action';
    }
  };

  const getDialogContent = () => {
    const user = confirmDialog.user;
    if (!user) return '';

    switch (confirmDialog.action) {
      case 'grant':
        return `Are you sure you want to grant admin access for ${user.name} (${user.email})?`;
      case 'revoke':
        return `Are you sure you want to revoke admin access from ${user.name} (${user.email})?`;
      case 'approve':
        return `Are you sure you want to approve ${user.name} (${user.email})?`;
      case 'deny':
        return `Are you sure you want to deny ${user.name} (${user.email})?`;
      case 'revoke-access':
        return `Are you sure you want to revoke access for ${user.name} (${user.email})?`;
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
          {/* Search Bar */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Filter Users
            </Typography>
            <TextField
              fullWidth
              label="Start typing to filter users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Start typing to filter users by name or email..."
              autoComplete="off"
            />
          </Box>

          {/* Pending Users Section */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                <HourglassEmpty sx={{ mr: 1, verticalAlign: 'middle' }} />
                Users Pending Approval ({filteredPendingUsers.length})
              </Typography>
              {pendingLoading && <CircularProgress size={20} />}
            </Box>
            
            {filteredPendingUsers.length > 0 ? (
              <>
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
                      {paginatedPendingUsers.map((user) => (
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
                
                {filteredPendingUsers.length > pendingUsersPerPage && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={Math.ceil(filteredPendingUsers.length / pendingUsersPerPage)}
                      page={pendingPage}
                      onChange={(_, page) => setPendingPage(page)}
                      color="primary"
                    />
                  </Box>
                )}
              </>
            ) : (
              <Alert severity="info">
                {searchTerm ? 'No pending users match your search criteria' : 'No users pending approval'}
              </Alert>
            )}
          </Box>

          {/* Approved Users Section */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                <AdminPanelSettings sx={{ mr: 1, verticalAlign: 'middle' }} />
                Active Users ({filteredApprovedUsers.length})
              </Typography>
              {loading && <CircularProgress size={20} />}
            </Box>
            
            {filteredApprovedUsers.length > 0 ? (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>User Type</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedApprovedUsers.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Person color="action" fontSize="small" />
                              {user.name}
                            </Box>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {user.isAdmin ? (
                                <>
                                  <AdminPanelSettings color="primary" fontSize="small" />
                                  Admin
                                </>
                              ) : (
                                'User'
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              {!isCurrentUser(user._id) && (
                                <>
                                  {user.isAdmin ? (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      color="warning"
                                      startIcon={<Cancel />}
                                      onClick={() => openConfirmDialog(user, 'revoke')}
                                    >
                                      Revoke Admin
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      color="primary"
                                      startIcon={<AdminPanelSettings />}
                                      onClick={() => openConfirmDialog(user, 'grant')}
                                    >
                                      Grant Admin
                                    </Button>
                                  )}
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    color="error"
                                    startIcon={<Cancel />}
                                    onClick={() => openConfirmDialog(user, 'revoke-access')}
                                  >
                                    Revoke Access
                                  </Button>
                                </>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                {filteredApprovedUsers.length > approvedUsersPerPage && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={Math.ceil(filteredApprovedUsers.length / approvedUsersPerPage)}
                      page={approvedPage}
                      onChange={(_, page) => setApprovedPage(page)}
                      color="primary"
                    />
                  </Box>
                )}
              </>
            ) : (
              <Alert severity="info">
                {searchTerm ? 'No approved users match your search criteria' : 'No approved users found'}
              </Alert>
            )}
          </Box>
        </Paper>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialog.open} onClose={closeConfirmDialog}>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogContent>
            <DialogContentText>{getDialogContent()}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeConfirmDialog}>Cancel</Button>
            <Button onClick={confirmAction} color="primary" variant="contained">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </AuthenticatedLayout>
  );
} 
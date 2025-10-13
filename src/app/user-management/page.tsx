"use client";

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
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
  DialogContent,
  DialogContentText,
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
import { useSearchPagination, useConfirmDialog } from '@/lib/hooks';
import { responsiveDialogStyle } from '@/lib/theme';
import SearchBar from '@/components/optimized/SearchBar';
import Pagination from '@/components/optimized/Pagination';
import { DialogActions, DialogTitle } from '@/components/ui';

interface User {
  _id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isApproved: boolean;
}

// Add interface for confirm dialog data
interface ConfirmDialogData {
  user: User;
  action: 'grant' | 'revoke' | 'approve' | 'deny' | 'revoke-access';
}

export default function UserManagementPage() {
  const { data: session } = useSession();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  // Dialogs
  const confirmDialog = useConfirmDialog<ConfirmDialogData>();
  // Search and pagination
  const pendingPagination = useSearchPagination({
    data: pendingUsers,
    itemsPerPage: 5,
    searchFields: ['name', 'email']
  });
  const approvedPagination = useSearchPagination({
    data: approvedUsers,
    itemsPerPage: 25,
    searchFields: ['name', 'email']
  });

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
          isApproved: approved,
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
    confirmDialog.openDialog({ user, action });
  };

  const closeConfirmDialog = () => {
    confirmDialog.closeDialog();
  };

  const confirmAction = async () => {
    const data = confirmDialog.data;
    if (!data) return;
    const { user, action } = data;

    if (action === 'approve') {
      await handleApproval(user._id, true);
    } else if (action === 'deny') {
      await handleApproval(user._id, false);
    } else if (action === 'revoke-access') {
      await handleApproval(user._id, false);
    } else {
      await handleToggleAdmin(user._id, user.isAdmin);
    }
    
    closeConfirmDialog();
  };

  const isCurrentUser = (userId: string) => {
    return session?.user?.email && [...pendingUsers, ...approvedUsers].find(u => u._id === userId)?.email === session.user.email;
  };

  const getDialogTitle = () => {
    switch (confirmDialog.data?.action) {
      case 'grant': return 'Grant Admin Access';
      case 'revoke': return 'Revoke Admin Access';
      case 'approve': return 'Approve User';
      case 'deny': return 'Deny User';
      case 'revoke-access': return 'Revoke Access';
      default: return 'Confirm Action';
    }
  };

  const getDialogContent = () => {
    const data = confirmDialog.data;
    if (!data) return '';
    
    const user = data.user;
    if (!user) return '';

    switch (data.action) {
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
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Manage Users
        </Typography>
        
        <Paper sx={{ p: 3, mt: { xs: 2, md: 3 } }}>
          {/* Search Bar */}
          <Box sx={{ mb: 4 }}>
            <SearchBar
              value={pendingPagination.searchTerm}
              onChange={(value) => pendingPagination.setSearchTerm(value)}
              placeholder="Start typing to filter users by name or email..."
            />
          </Box>

          {/* Pending Users Section */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' }, 
              gap: { xs: 1, sm: 0 },
              mb: 2 
            }}>
              <Typography variant="h6" gutterBottom>
                <HourglassEmpty sx={{ mr: 1, verticalAlign: 'middle' }} />
                Users Pending Approval ({pendingPagination.searchTerm ? `${pendingPagination.totalItems}/${pendingUsers?.length || 0}` : pendingUsers?.length || 0})
              </Typography>
              {pendingLoading && <CircularProgress size={20} />}
            </Box>
            
            {pendingPagination.filteredData.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Registration Date</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pendingPagination.paginatedData.map((user) => (
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
                </Box>

                {/* Mobile Card View */}
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  {pendingPagination.paginatedData.map((user) => (
                    <Paper
                      key={user._id}
                      sx={{
                        p: 3,
                        mb: 2,
                        boxShadow: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Person color="action" fontSize="small" />
                          <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                            {user.name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Registration Date: Recent
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          color="success"
                          startIcon={<CheckCircle />}
                          onClick={() => openConfirmDialog(user, 'approve')}
                          fullWidth={false}
                          sx={{ flex: 1 }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<Cancel />}
                          onClick={() => openConfirmDialog(user, 'deny')}
                          fullWidth={false}
                          sx={{ flex: 1 }}
                        >
                          Deny
                        </Button>
                      </Box>
                    </Paper>
                  ))}
                </Box>
                
                {pendingPagination.filteredData.length > 5 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={pendingPagination.totalPages}
                      page={pendingPagination.currentPage}
                      onChange={pendingPagination.setCurrentPage}
                    />
                  </Box>
                )}
              </>
            ) : (
              <Alert severity="info">
                {pendingPagination.searchTerm ? 'No pending users match your search criteria' : 'No users pending approval'}
              </Alert>
            )}
          </Box>

          {/* Approved Users Section */}
          <Box>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' }, 
              gap: { xs: 1, sm: 0 },
              mb: 2 
            }}>
              <Typography variant="h6" gutterBottom>
                <AdminPanelSettings sx={{ mr: 1, verticalAlign: 'middle' }} />
                Active Users ({approvedPagination.searchTerm ? `${approvedPagination.totalItems}/${approvedUsers?.length || 0}` : approvedUsers?.length || 0})
              </Typography>
              {loading && <CircularProgress size={20} />}
            </Box>
            
            {approvedPagination.filteredData.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>User Type</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {approvedPagination.paginatedData.map((user) => (
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
                </Box>

                {/* Mobile Card View */}
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  {approvedPagination.paginatedData.map((user) => (
                    <Paper
                      key={user._id}
                      sx={{
                        p: 3,
                        mb: 2,
                        boxShadow: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Person color="action" fontSize="small" />
                          <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                            {user.name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {user.isAdmin ? (
                            <>
                              <AdminPanelSettings color="primary" fontSize="small" />
                              <Typography variant="body2" color="primary">
                                Admin
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              User
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      {!isCurrentUser(user._id) && (
                        <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                          {user.isAdmin ? (
                            <Button
                              variant="outlined"
                              size="small"
                              color="warning"
                              startIcon={<Cancel />}
                              onClick={() => openConfirmDialog(user, 'revoke')}
                              fullWidth={false}
                              sx={{ flex: 1 }}
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
                              fullWidth={false}
                              sx={{ flex: 1 }}
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
                            fullWidth={false}
                            sx={{ flex: 1 }}
                          >
                            Revoke Access
                          </Button>
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Box>
                
                {approvedPagination.filteredData.length > 25 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={approvedPagination.totalPages}
                      page={approvedPagination.currentPage}
                      onChange={approvedPagination.setCurrentPage}
                    />
                  </Box>
                )}
              </>
            ) : (
              <Alert severity="info">
                {approvedPagination.searchTerm ? 'No approved users match your search criteria' : 'No approved users found'}
              </Alert>
            )}
          </Box>
        </Paper>

        {/* Confirmation Dialog */}
        <Dialog 
          open={confirmDialog.open} 
          onClose={closeConfirmDialog}
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={closeConfirmDialog}>{getDialogTitle()}</DialogTitle>
          <DialogContent>
            <DialogContentText>{getDialogContent()}</DialogContentText>
            <DialogActions primaryButtonIndex={1}>
              <Button onClick={closeConfirmDialog}>
                Cancel
              </Button>
              <Button 
                onClick={confirmAction} 
                color="primary" 
                variant="contained"
              >
                Confirm
              </Button>
            </DialogActions>
          </DialogContent>
        </Dialog>
      </Container>
    </AuthenticatedLayout>
  );
} 
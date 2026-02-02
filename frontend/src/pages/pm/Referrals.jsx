import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  Share2, Copy, Plus, X, Upload
} from 'lucide-react';
import { authAPI } from '../../api/auth';
import { referralsAPI } from '../../api/referrals';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Loading from '../../components/Loading';


const Referrals = ({ userRole }) => {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    university: '',
    address: '',
    paidAmount: 0,
    paySlip: null,
    status: 'pending',
    roleId: 'interners'
  });
  const [referrals, setReferrals] = useState([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [loadingCount, setLoadingCount] = useState(0);

  const THEME = {
    gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  };

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);
  const copyReferralCode = async (code) => {
    if (!code) {
      toast.error('No referral code available');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Referral code copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy referral code');
    }
  };

  // Fetch user's referral data from API
  const fetchReferrals = async () => {
    startLoading();
    try {
      const profileResponse = await authAPI.getProfile();

      if (!profileResponse.success) {
        throw new Error('Failed to get user profile');
      }

      const currentUserId = profileResponse.data.id;

      const response = await referralsAPI.getMy();

      if (response.success) {
        const referralsData = response.data.referrals || [];

        // Transform API data to match UI format (same as admin)
        const transformedReferrals = referralsData
          .filter(ref => ref.joinedUser?.status !== 'suspended') // Filter out suspended users
          .map(ref => {
          const paidAmount = ref.joinedUser?.paidAmount || 0;
          const commissionAmount = paidAmount ? Math.round(paidAmount * 0.20) : 0;

          return {
            id: ref.id,
            name: ref.joinedUser ? `${ref.joinedUser.firstName} ${ref.joinedUser.lastName}` : 'Unknown',
            position: ref.joinedUser?.position?.name || 'Employee',
            date: new Date(ref.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: ref.joinedUser?.status || 'Pending',
            paidAmount,
            commissionAmount,
            withdrawAmount: ref.withdrawAmount || 0
          };
        });

        setReferrals(transformedReferrals);

        // Calculate totals using the same 20% commission logic as admin
        const totalPaid = transformedReferrals.reduce((sum, ref) => sum + ref.paidAmount, 0);
        const totalComm = transformedReferrals.reduce((sum, ref) => sum + (ref.paidAmount ? Math.round(ref.paidAmount * 0.20) : 0), 0);
        const totalWithdrawn = transformedReferrals.reduce((sum, ref) => sum + (ref.withdrawAmount || 0), 0);
        setTotalCommission(totalComm);
        setAvailableBalance(totalComm - totalWithdrawn);
      }
    } catch (error) {
      handleError(error);
    } finally {
      stopLoading();
    }
  };

  const fetchUserProfile = async () => {
    startLoading();
    try {
      const response = await authAPI.getProfile();

      if (response.success) {
        const userData = response.data;
        setReferralCode(userData.referralCode || '');
      }
    } catch (error) {
    } finally {
      stopLoading();
    }
  };

  useEffect(() => {
    fetchReferrals();
    fetchUserProfile();
  }, []);

  // Form validation
  const validateForm = () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email) {
      toast.error('Please fill in all required fields');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleAddUser = async () => {
    if (!validateForm()) return;

    startLoading();
    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add user details
      const userFields = {
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        email: newUser.email.toLowerCase().trim(),
        phoneNumber: newUser.phoneNumber?.trim(),
        paidAmount: newUser.paidAmount ? Number(newUser.paidAmount) : 0,
        university: newUser.university?.trim(),
        address: newUser.address?.trim(),
        status: newUser.status
      };

      Object.entries(userFields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });
      
      // Add role information
      if (newUser.roleId) {
        formData.append('roleId', newUser.roleId);
      }
      
      if (newUser.paySlip) {
        formData.append('paymentSlip', newUser.paySlip);
      }
      
      formData.append('generatePassword', 'true');

      const response = await referralsAPI.createWithUser(formData);

      if (response.success) {
        handleSuccess();
      } else {
        handleError(new Error(response.data.message));
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewUser({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      paidAmount: '',
      university: '',
      address: '',
      paySlip: null,
      status: 'pending'
    });
  };

  const handleSuccess = () => {
    toast.success('Referral added successfully!');
    setShowAddUserModal(false);
    resetForm();
    fetchReferrals();
  };

  const handleError = (error) => {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        'Failed to add referral. Please try again.';
    toast.error(errorMessage);
  };

  // Pagination
  const totalPages = Math.ceil(referrals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReferrals = referrals.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewUser({ ...newUser, paySlip: file });
      toast.success('Pay slip uploaded successfully');
    }
  };

  return (
    <div className="space-y-6">
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      <div className="bg-white rounded-2xl p-8 text-slate-800 shadow-lg relative overflow-hidden border border-slate-200">
        <div className="relative z-10 max-w-xl">
          <h2 className="text-3xl font-bold mb-2 text-slate-900">Mentorship Referral Program</h2>
          <p className="text-slate-600 mb-6 text-lg">Refer an intern and earn 20% of the paid amount for every successful referral. Open to all current employees and interns.</p>

          <div className="flex gap-2 max-w-sm">
            <div className="bg-slate-100 border border-slate-300 rounded-lg px-4 py-3 font-mono text-lg tracking-wider flex-1 flex items-center whitespace-nowrap text-slate-800">
              {referralCode || 'Loading...'}
            </div>
            <Button className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none shadow-none" icon={Copy} onClick={() => copyReferralCode(referralCode)}>
              Copy
            </Button>
          </div>
        </div>
        <Share2 className="absolute -right-8 -bottom-8 text-slate-200 w-64 h-64 rotate-12" />
      </div>

      {/* Balance Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Available Balance</h3>
          <div className="text-3xl font-bold text-[#C4009A] mb-2">
            LKR {availableBalance.toLocaleString()}
          </div>
          <p className="text-sm text-slate-500">Total earnings available</p>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Total Commission</h3>
          <div className="text-3xl font-bold text-green-600 mb-2">
            LKR {totalCommission.toLocaleString()}
          </div>
          <p className="text-sm text-slate-500">Total commission from referrals</p>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Total Withdrawn</h3>
          <div className="text-3xl font-bold text-blue-600 mb-2">
            LKR {referrals.reduce((sum, ref) => sum + (ref.withdrawAmount || 0), 0).toLocaleString()}
          </div>
          <p className="text-sm text-slate-500">Amount already withdrawn</p>
        </Card>
      </div>

      <Card className="p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Your Referrals</h3>
          <Button
            icon={Plus}
            onClick={() => setShowAddUserModal(true)}
            className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
          >
            Add Referral
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-6 py-3">Candidate</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Paid Amount</th>
                <th className="px-6 py-3">Commission Amount</th>
                <th className="px-6 py-3">Withdraw Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedReferrals.map((referral, index) => (
                <tr key={index} className="border-t border-slate-200">
                  <td className="px-6 py-4 font-medium">{referral.name}</td>
                  <td className="px-6 py-4">{referral.date}</td>
                  <td className="px-6 py-4">
                    <Badge 
                      color={
                        referral.status === 'active' ? 'success' :
                        referral.status === 'inactive' ? 'error' :
                        referral.status === 'pending' ? 'warning' :
                        referral.status === 'suspended' ? 'brand' :
                        'default'
                      }
                    >
                      {referral.status === 'active' ? 'Active' :
                       referral.status === 'inactive' ? 'Inactive' :
                       referral.status === 'pending' ? 'Pending' :
                       referral.status === 'suspended' ? 'Suspended' :
                       referral.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">LKR {referral.paidAmount.toLocaleString()}</td>
                  <td className="px-6 py-4">LKR {referral.commissionAmount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {referral.withdrawAmount ? (
                      <span className="text-blue-600 font-medium">LKR {referral.withdrawAmount.toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, referrals.length)} of {referrals.length} referrals
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 text-sm border rounded ${
                    currentPage === page
                      ? "bg-[#C4009A] text-white border-[#C4009A]"
                      : "border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add New Referral</h2>
                <p className="text-sm text-slate-600 mt-1">Password will be auto-generated by the system</p>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={newUser.phoneNumber}
                    onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">University *</label>
                  <input
                    type="text"
                    value={newUser.university}
                    onChange={(e) => setNewUser({ ...newUser, university: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter university name"
                  />
                </div>


                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Paid Amount *</label>
                  <input
                    type="number"
                    value={newUser.paidAmount}
                    onChange={(e) => setNewUser({ ...newUser, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter paid amount"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address *</label>
                <textarea
                  value={newUser.address}
                  onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter full address"
                  rows="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pay Slip Upload *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="paySlip"
                  />
                  <label
                    htmlFor="paySlip"
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Upload size={16} />
                    <span className="text-sm">
                      {newUser.paySlip ? newUser.paySlip.name : 'Choose file or drag and drop'}
                    </span>
                  </label>
                  {newUser.paySlip && (
                    <span className="text-xs text-green-600 font-medium">
                      ✓ File uploaded
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowAddUserModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddUser}
                disabled={!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.phoneNumber || !newUser.university || !newUser.paidAmount || !newUser.address || !newUser.paySlip}
                className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
              >
                Add Referral
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;

import React, { useCallback, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { referralsAPI } from '../../api/referrals';
import { usersAPI } from '../../api/users';
import {
  TrendingUp, Users, Award, DollarSign, Calendar, Search, Filter,
  Download, Copy, CheckCircle, Clock, X, Eye, Mail, Phone, ChevronDown
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import SearchableDropdown from '../../components/SearchableDropdown';
import Loading from '../../components/Loading';

const AdminReferrals = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReferralDetails, setShowReferralDetails] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loadingCount, setLoadingCount] = useState(0);
  const [filters, setFilters] = useState({
    candidateName: '',
    position: '',
    status: '',
    referredBy: ''
  });
  const [referralSearch, setReferralSearch] = useState('');
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
  const [referralActivities, setReferralActivities] = useState([]);
  const [referralStats, setReferralStats] = useState({
    totalReferrals: 0,
    activeReferrers: 0,
    totalPaidOut: 0,
    pendingReferrals: 0,
    conversionRate: 0,
    monthlyGrowth: 0
  });
  const [topReferrers, setTopReferrers] = useState([]);
  const [users, setUsers] = useState([]);

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const filteredReferrers = topReferrers.filter(referrer =>
    referrer.name.toLowerCase().includes(referralSearch.toLowerCase())
  );

  const handleReferrerSelect = (referrer) => {
    setFilters(prev => ({ ...prev, referredBy: referrer.name }));
    setReferralSearch(referrer.name);
    setShowReferralDropdown(false);
  };

  const exportToCSV = () => {
    // Create CSV content
    const headers = ['Candidate Name', 'Position', 'Referred By', 'Status', 'Date', 'Payout Amount'];
    const csvContent = [
      headers.join(','),
      ...filteredActivities.map(activity => [
        `"${activity.candidateName}"`,
        `"${activity.position}"`,
        `"${activity.referredBy}"`,
        `"${activity.status}"`,
        `"${activity.date}"`,
        `"${activity.payoutAmount ? activity.payoutAmount : 'Pending'}"`
      ].join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `referral-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV report downloaded successfully!');
  };

  // Mock data for all referral activities
  const referralActivitiesData = [
    { id: 1, candidateName: 'John Doe', candidateEmail: 'john@example.com', position: 'Senior React Dev', referredBy: 'Mike Wilson', referralCode: 'FUCH-MIKE-003', status: 'hired', date: '2024-01-10', payoutAmount: 50000, hiredDate: '2024-01-15', commissionStatus: 'paid' },
    { id: 2, candidateName: 'Jane Smith', candidateEmail: 'jane@example.com', position: 'UX Designer', referredBy: 'Alex Johnson', referralCode: 'FUCH-ALEX-001', status: 'interviewing', date: '2024-01-08', payoutAmount: null, hiredDate: null, commissionStatus: 'pending' },
    { id: 3, candidateName: 'Bob Wilson', candidateEmail: 'bob@example.com', position: 'Backend Dev', referredBy: 'Sarah Chen', referralCode: 'FUCH-SARAH-002', status: 'hired', date: '2024-01-05', payoutAmount: 50000, hiredDate: '2024-01-12', commissionStatus: 'processing' },
    { id: 4, candidateName: 'Alice Brown', candidateEmail: 'alice@example.com', position: 'DevOps Engineer', referredBy: 'Mike Wilson', referralCode: 'FUCH-MIKE-003', status: 'pending', date: '2024-01-12', payoutAmount: null, hiredDate: null, commissionStatus: 'pending' },
    { id: 5, candidateName: 'Charlie Davis', candidateEmail: 'charlie@example.com', position: 'Frontend Dev', referredBy: 'Emily Davis', referralCode: 'FUCH-EMILY-004', status: 'rejected', date: '2024-01-03', payoutAmount: null, hiredDate: null, commissionStatus: 'cancelled' },
    { id: 6, candidateName: 'Diana Miller', candidateEmail: 'diana@example.com', position: 'QA Engineer', referredBy: 'Alex Johnson', referralCode: 'FUCH-ALEX-001', status: 'hired', date: '2024-01-07', payoutAmount: 50000, hiredDate: '2024-01-14', commissionStatus: 'paid' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'pending': return 'warning';
      case 'suspended': return 'brand';
      default: return 'default';
    }
  };

  const copyReferralCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Referral code copied to clipboard!');
  };

  const handleUpdateWithdrawAmount = async () => {
    startLoading();
    try {
      // Calculate new total withdraw amount (current + new input)
      const currentWithdrawAmount = showReferralDetails.withdrawAmount || 0;
      const newWithdrawAmount = parseFloat(withdrawAmount) || 0;
      const totalWithdrawAmount = currentWithdrawAmount + newWithdrawAmount;
      
      const response = await referralsAPI.update(showReferralDetails.id, {
        withdrawAmount: totalWithdrawAmount
      });

      if (response.success) {
        toast.success('Withdraw amount updated successfully');
        fetchReferrals();
        setShowReferralDetails(prev => ({
          ...prev,
          withdrawAmount: totalWithdrawAmount
        }));
        setWithdrawAmount('');
      } else {
        toast.error('Failed to update withdraw amount');
      }
    } catch (error) {
      toast.error('Failed to update withdraw amount');
    } finally {
      stopLoading();
    }
  };

  const handleProcessPayout = async (referralId) => {
    startLoading();
    try {
      const response = await referralsAPI.update(referralId, {
        commissionStatus: 'paid'
      });

      if (response.success) {
        toast.success('Commission payout processed successfully');
        fetchReferrals();
        setShowReferralDetails(null);
      } else {
        toast.error('Failed to process payout');
      }
    } catch (error) {
      toast.error('Failed to process payout');
    } finally {
      stopLoading();
    }
  };

  const handleContactCandidate = (candidateEmail, candidateName) => {
    const subject = encodeURIComponent('Regarding Your Referral Application');
    const body = encodeURIComponent(`Dear ${candidateName},\n\nI hope this message finds you well. I'm reaching out regarding your recent referral application.\n\nWe would like to discuss the next steps in the process with you.\n\nBest regards`);
    const mailtoUrl = `mailto:${candidateEmail}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
    toast.success('Opening email client to contact candidate');
  };

  const handleContactReferrer = (referrerName, referralCode) => {
    const subject = encodeURIComponent('Regarding Your Referral');
    const body = encodeURIComponent(`Dear ${referrerName},\n\nThank you for your referral using code: ${referralCode}.\n\nWe wanted to update you on the status and discuss any questions you may have.\n\nBest regards`);
    // Since we don't have referrer email directly, we'll show a modal or use a general contact
    toast.info(`Please contact ${referrerName} regarding referral ${referralCode}`);
    // Alternatively, you could have a general contact email
    const generalEmail = 'referrals@company.com';
    const mailtoUrl = `mailto:${generalEmail}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleStatusChange = async (referralId, newStatus) => {
    startLoading();
    try {
      const referral = referralActivities.find(r => r.id === referralId);
      if (!referral || !referral.joinedUserId) {
        toast.error('Unable to find user for this referral');
        return;
      }

      const response = await usersAPI.update(referral.joinedUserId, {
        status: newStatus
      });

      if (response.success) {
        setReferralActivities(prevActivities =>
          prevActivities.map(activity =>
            activity.id === referralId
              ? { ...activity, status: newStatus }
              : activity
          )
        );
        setShowReferralDetails(prev =>
          prev ? { ...prev, status: newStatus } : null
        );
        toast.success('Status updated successfully');
      } else {
        toast.error(response.message || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      stopLoading();
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const clearFilters = () => {
    setFilters({ candidateName: '', position: '', status: '', referredBy: '' });
    setReferralSearch('');
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showReferralDropdown && !event.target.closest('.referral-dropdown')) {
        setShowReferralDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReferralDropdown]);

  const fetchReferrals = async () => {
    startLoading();
    try {
      const response = await referralsAPI.getAll();
      if (response.success) {
        const transformedData = response.data.referrals
          .filter(ref => ref.joinedUser?.status !== 'suspended') // Filter out suspended users
          .map(ref => ({
          id: ref.id,
          joinedUserId: ref.joinedUser?.id, // Add the joined user ID for status updates
          candidateName: ref.joinedUser ? `${ref.joinedUser.firstName} ${ref.joinedUser.lastName}` : 'Unknown',
          candidateEmail: ref.joinedUser?.email || 'Unknown',
          position: ref.joinedUser?.position?.name || 'Employee',
          referredBy: ref.referredBy ? `${ref.referredBy.firstName} ${ref.referredBy.lastName}` : 'Unknown',
          referralCode: ref.referredBy?.referralCode || 'N/A',
          status: ref.joinedUser?.status || 'pending',
          date: new Date(ref.createdAt).toISOString().split('T')[0],
          // Calculate 20% commission from user's paidAmount
          payoutAmount: ref.joinedUser?.paidAmount ? Math.round(ref.joinedUser.paidAmount * 0.20) : null,
          hiredDate: new Date(ref.createdAt).toISOString().split('T')[0],
          commissionStatus: 'pending', // Default status
          paidAmount: ref.joinedUser?.paidAmount || null, // Get paid amount from the joined user
          withdrawAmount: ref.withdrawAmount || null // Get withdraw amount from referral record (using paidAmount field)
        }));
        setReferralActivities(transformedData);
        calculateTopReferrers(); // Calculate top referrers when data is fetched
      }
    } catch (error) {
      toast.error('Failed to fetch referrals');
    } finally {
      stopLoading();
    }
  };

  const fetchStats = async () => {
    startLoading();
    try {
      const response = await referralsAPI.getStats();
      if (response.success) {
        const stats = response.data;
        setReferralStats({
          totalReferrals: stats.totalReferrals || 0,
          activeReferrers: stats.pendingReferrals || 0,
          totalPaidOut: stats.totalPaid || 0,
          pendingReferrals: stats.pendingReferrals || 0,
          conversionRate: stats.approvedReferrals ? Math.round((stats.approvedReferrals / stats.totalReferrals) * 100) : 0,
          monthlyGrowth: 0
        });
      }
    } catch (error) {
    } finally {
      stopLoading();
    }
  };

  // Calculate top referrers from referral activities
  const calculateTopReferrers = () => {
    const referrersWithCounts = {};
    
    referralActivities.forEach(referral => {
      if (referral.referredBy) {
        const referrerName = referral.referredBy;
        if (!referrersWithCounts[referrerName]) {
          referrersWithCounts[referrerName] = {
            name: referrerName,
            totalReferrals: 0,
            successfulReferrals: 0,
            totalEarned: 0,
            referredUsers: []
          };
        }
        referrersWithCounts[referrerName].totalReferrals++;
        
        // Count successful referrals (those with paid amounts)
        if (referral.paidAmount && referral.paidAmount > 0) {
          referrersWithCounts[referrerName].successfulReferrals++;
          // Calculate 20% commission earnings
          referrersWithCounts[referrerName].totalEarned += Math.round(referral.paidAmount * 0.20);
        }
        
        // Track who they referred
        referrersWithCounts[referrerName].referredUsers.push(referral.candidateName);
      }
    });

    const topReferrersList = Object.values(referrersWithCounts)
      .sort((a, b) => b.totalReferrals - a.totalReferrals)
      .slice(0, 5)
      .map((referrer, index) => ({
        id: `referrer-${index}`,
        name: referrer.name,
        totalReferrals: referrer.totalReferrals,
        successfulReferrals: referrer.successfulReferrals,
        totalEarned: referrer.totalEarned,
        referredUsers: referrer.referredUsers.slice(0, 3),
        avatar: referrer.name.split(' ').map(n => n[0]).join('').toUpperCase()
      }));
    setTopReferrers(topReferrersList);
  };

  const fetchUsers = async () => {
    startLoading();
    try {
      const response = await usersAPI.getAll();
      if (response.success) {
        setUsers(response.data.users);
        calculateTopReferrers();
      }
    } catch (error) {
    } finally {
      stopLoading();
    }
  };

  // Load data on mount
  React.useEffect(() => {
    fetchReferrals();
    fetchStats();
    fetchUsers();
  }, []);

  // Refresh data function
  const refreshData = () => {
    fetchReferrals();
    fetchStats();
    fetchUsers();
    toast.success('Data refreshed successfully');
  };

  const filteredActivities = referralActivities.filter(activity => {
    const candidateNameMatch = activity.candidateName.toLowerCase().includes(filters.candidateName.toLowerCase());
    const positionMatch = !filters.position || activity.position.toLowerCase().includes(filters.position.toLowerCase());
    const statusMatch = !filters.status || activity.status.toLowerCase().includes(filters.status.toLowerCase());
    const referredByMatch = !filters.referredBy || activity.referredBy.toLowerCase().includes(filters.referredBy.toLowerCase());
    const searchTermMatch = !searchTerm || (
      activity.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.referredBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.position.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return candidateNameMatch && positionMatch && statusMatch && referredByMatch && searchTermMatch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedActivities = filteredActivities.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
    fetchUsers(1, itemsPerPage, {});
  }, [filters.candidateName, filters.position, filters.status, filters.referredBy, searchTerm]);

  return (
    <div className="space-y-6">
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Referral Management</h1>
          <p className="text-slate-500 mt-1">Track and manage employee referral program</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData}>Refresh</Button>
          <Button variant="outline" icon={Download} onClick={exportToCSV}>Export Report</Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Referrals Card */}
        <Card className="p-4 sm:p-5 hover:shadow-md transition-shadow duration-200 h-full">
          <div className="flex items-start justify-between h-full">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500 mb-1">Total Referrals</p>
              <p className="text-2xl font-bold text-slate-800 mb-2">{referralActivities.length}</p>
              <p className="text-xs text-green-600">All time referrals</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex-shrink-0 flex items-center justify-center ml-4">
              <Users className="text-blue-600" size={20} />
            </div>
          </div>
        </Card>

        {/* Total Withdrawn Card */}
        <Card className="p-4 sm:p-5 hover:shadow-md transition-shadow duration-200 h-full">
          <div className="flex items-start justify-between h-full">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500 mb-1">Total Withdrawn</p>
              <p className="text-2xl font-bold text-slate-800 mb-2">
                LKR {referralActivities.reduce((sum, ref) => sum + (ref.withdrawAmount || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">Amount paid to referrers</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex-shrink-0 flex items-center justify-center ml-4">
              <TrendingUp className="text-green-600" size={20} />
            </div>
          </div>
        </Card>

        {/* Total Commission Card */}
        <Card className="p-4 sm:p-5 hover:shadow-md transition-shadow duration-200 h-full">
          <div className="flex items-start justify-between h-full">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500 mb-1">Total Commission</p>
              <p className="text-2xl font-bold text-slate-800 mb-2">
                LKR {referralActivities.reduce((sum, ref) => sum + (ref.paidAmount ? Math.round(ref.paidAmount * 0.20) : 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">20% of paid amounts</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex-shrink-0 flex items-center justify-center ml-4">
              <DollarSign className="text-amber-600" size={20} />
            </div>
          </div>
        </Card>

        {/* Available for Withdrawal Card */}
        <Card className="p-4 sm:p-5 hover:shadow-md transition-shadow duration-200 h-full">
          <div className="flex items-start justify-between h-full">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500 mb-1">Available for Withdrawal</p>
              <p className="text-2xl font-bold text-slate-800 mb-2">
                LKR {referralActivities.reduce((sum, ref) => sum + Math.max(0, Math.round(ref.paidAmount * 0.20) - (ref.withdrawAmount || 0)), 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">Total commission minus withdrawals</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex-shrink-0 flex items-center justify-center ml-4">
              <Award className="text-purple-600" size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Referral Activities Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Recent Referral Activities</h3>

          {/* Filters Row */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600 font-medium w-full sm:w-auto">Filters:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search referrals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A] w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Candidate Name</label>
                <input
                  type="text"
                  placeholder="Enter candidate name..."
                  value={filters.candidateName}
                  onChange={(e) => handleFilterChange('candidateName', e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A] w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                <SearchableDropdown
                  options={[
                    { id: 'Software Engineer', name: 'Software Engineer' },
                    { id: 'UI/UX Designer', name: 'UI/UX Designer' },
                    { id: 'Project Manager', name: 'Project Manager' },
                    { id: 'DevOps Engineer', name: 'DevOps Engineer' },
                    { id: 'Frontend Dev', name: 'Frontend Dev' },
                    { id: 'QA Engineer', name: 'QA Engineer' }
                  ]}
                  value={filters.position || 'all'}
                  onChange={(value) => handleFilterChange('position', value === 'all' ? '' : value)}
                  placeholder="All Positions"
                  allOptionLabel="All Positions"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <SearchableDropdown
                  options={[
                    { id: 'active', name: 'Active' },
                    { id: 'pending', name: 'Pending' },
                    { id: 'suspended', name: 'Suspended' },
                    { id: 'inactive', name: 'Inactive' }
                  ]}
                  value={filters.status || 'all'}
                  onChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
                  placeholder="All Statuses"
                  allOptionLabel="All Statuses"
                />
              </div>

              <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Referred By</label>
                <div className="relative referral-dropdown">
                  <input
                    type="text"
                    value={referralSearch || filters.referredBy}
                    onChange={(e) => {
                      setReferralSearch(e.target.value);
                      setFilters(prev => ({ ...prev, referredBy: e.target.value }));
                      setShowReferralDropdown(true);
                    }}
                    onFocus={() => setShowReferralDropdown(true)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Search and select referrer"
                  />

                  {showReferralDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredReferrers.length > 0 ? (
                        filteredReferrers.map((referrer) => (
                          <button
                            key={referrer.id}
                            onClick={() => handleReferrerSelect(referrer)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"
                          >
                            <Avatar size="sm" fallback={referrer.name.split(' ').map(n => n[0]).join('')} />
                            <div>
                              <p className="font-medium text-slate-800">{referrer.name}</p>
                              <p className="text-xs text-slate-500">{referrer.referralCode} • {referrer.totalReferrals} referrals</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          No referrers found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="whitespace-nowrap w-full sm:w-auto">Clear Filters</Button>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {Object.values(filters).some(value => value) && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
              <span className="font-medium">Active filters:</span>
              {filters.candidateName && <span className="bg-white px-2 py-1 rounded border border-slate-200">Candidate: {filters.candidateName}</span>}
              {filters.position && <span className="bg-white px-2 py-1 rounded border border-slate-200">Position: {filters.position}</span>}
              {filters.status && <span className="bg-white px-2 py-1 rounded border border-slate-200">Status: {filters.status}</span>}
              {filters.referredBy && <span className="bg-white px-2 py-1 rounded border border-slate-200">Referred by: {filters.referredBy}</span>}
              <span className="text-fuchsia-600 font-medium ml-auto">{filteredActivities.length} results found</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Referred By</th>
                <th className="px-6 py-4">Referral Code</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Commission (20%)</th>
                <th className="px-6 py-4">Withdraw Amount</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedActivities.length > 0 ? (
                paginatedActivities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{activity.candidateName}</p>
                        <p className="text-xs text-slate-500">{activity.candidateEmail}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{activity.position}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm" fallback={activity.referredBy.split(' ').map(n => n[0]).join('')} />
                        <span className="text-sm">{activity.referredBy}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">{activity.referralCode}</code>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{new Date(activity.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <Badge color={getStatusColor(activity.status)}>
                        {activity.status === 'active' ? 'Active' :
                         activity.status === 'inactive' ? 'Inactive' :
                         activity.status === 'pending' ? 'Pending' :
                         activity.status === 'suspended' ? 'Suspended' :
                         activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {activity.paidAmount ? (
                        <div className="flex flex-col">
                          <span className="text-green-600 font-medium">LKR {Math.round(activity.paidAmount * 0.20).toLocaleString()}</span>
                          <span className="text-xs text-slate-500">20% of LKR {activity.paidAmount.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {activity.withdrawAmount ? (
                        <span className="text-blue-600 font-medium">LKR {activity.withdrawAmount.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setShowReferralDetails(activity)}
                        className="text-slate-400 hover:text-slate-600"
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={48} className="text-slate-300" />
                      <p className="text-lg font-medium">No referrals found</p>
                      <p className="text-sm">Referrals will appear here when users are referred and make payments.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredActivities.length)} of {filteredActivities.length} referrals
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              {(() => {
                const pages = [];
                const maxVisible = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                
                // Adjust start page if we're near the end
                if (endPage - startPage + 1 < maxVisible) {
                  startPage = Math.max(1, endPage - maxVisible + 1);
                }
                
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(i);
                }
                
                return pages.map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className={currentPage === page ? "bg-[#C4009A] hover:bg-[#C4009A]/90 text-white" : ""}
                  >
                    {page}
                  </Button>
                ));
              })()}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Referral Details Modal */}
      {showReferralDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 min-h-screen">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Referral Details</h2>
              <button
                onClick={() => setShowReferralDetails(null)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Candidate Name</p>
                  <p className="font-medium text-slate-800">{showReferralDetails.candidateName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="font-medium text-slate-800">{showReferralDetails.candidateEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Position</p>
                  <p className="font-medium text-slate-800">{showReferralDetails.position}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Status</p>
                  <SearchableDropdown
                    options={[
                      { id: 'active', name: 'Active' },
                      { id: 'pending', name: 'Pending' },
                      { id: 'suspended', name: 'Suspended' },
                      { id: 'inactive', name: 'Inactive' }
                    ]}
                    value={showReferralDetails.status}
                    onChange={(value) => handleStatusChange(showReferralDetails.id, value)}
                    placeholder="Select Status"
                    showAllOption={false}
                  />
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Referred By</p>
                  <p className="font-medium text-slate-800">{showReferralDetails.referredBy}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Referral Code</p>
                  <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">{showReferralDetails.referralCode}</code>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Referral Date</p>
                  <p className="font-medium text-slate-800">{new Date(showReferralDetails.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Original Paid Amount</p>
                  <p className="font-medium text-slate-800">
                    {showReferralDetails.paidAmount ? `LKR ${showReferralDetails.paidAmount.toLocaleString()}` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Commission (20%)</p>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      {showReferralDetails.paidAmount ? `LKR ${Math.round(showReferralDetails.paidAmount * 0.20).toLocaleString()}` : 'Pending'}
                    </p>
                    {showReferralDetails.paidAmount && (
                      <p className="text-xs text-slate-600">
                        Available for withdrawal: LKR {Math.max(0, Math.round(showReferralDetails.paidAmount * 0.20) - (showReferralDetails.withdrawAmount || 0)).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Withdraw Amount</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Enter withdraw amount"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                    />
                    <Button 
                      onClick={handleUpdateWithdrawAmount}
                      disabled={!withdrawAmount}
                      className="px-4 py-2"
                    >
                      Update
                    </Button>
                  </div>
                  {showReferralDetails.withdrawAmount && (
                    <p className="text-xs text-green-600 mt-1">
                      Current: LKR {showReferralDetails.withdrawAmount.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {showReferralDetails.status === 'hired' && showReferralDetails.hiredDate && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Hired Date</p>
                  <p className="font-medium text-slate-800">{new Date(showReferralDetails.hiredDate).toLocaleDateString()}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                {showReferralDetails.status === 'hired' && !showReferralDetails.payoutAmount && (
                  <Button icon={DollarSign} onClick={() => handleProcessPayout(showReferralDetails.id)}>Process Payout</Button>
                )}
                <Button 
                  variant="outline" 
                  icon={Mail} 
                  onClick={() => handleContactCandidate(showReferralDetails.candidateEmail, showReferralDetails.candidateName)}
                >
                  Contact Candidate
                </Button>
                <Button 
                  variant="outline" 
                  icon={Phone} 
                  onClick={() => handleContactReferrer(showReferralDetails.referredBy, showReferralDetails.referralCode)}
                >
                  Contact Referrer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReferrals;

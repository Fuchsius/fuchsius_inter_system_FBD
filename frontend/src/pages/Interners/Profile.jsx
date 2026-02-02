import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Shield, Eye, EyeOff, Camera, Loader2 } from 'lucide-react';
import { authAPI } from '../../api/auth';
import { usersAPI } from '../../api/users';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Loading from '../../components/Loading';


const Profile = ({ userRole }) => {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    // If it's already a full URL or data URL, return as-is
    if (avatar.startsWith('http') || avatar.startsWith('data:')) {
      return avatar;
    }
    // If it's a path starting with /uploads/, keep it as-is
    if (avatar.startsWith('/uploads/')) {
      return avatar;
    }
    // Otherwise, prepend /uploads/
    return `/uploads/${avatar}`;
  };

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return null;

      const response = await authAPI.getProfile();

      if (response.success) {
        const userData = response.data;
        setUser(userData);
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phone: userData.phone || ''
        });
        if (userData.avatar) {
          setProfileImage(getAvatarUrl(userData.avatar));
        }
        return userData;
      }
      return null;
    } catch (error) {
      toast.error('Failed to load profile');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingImage(reader.result);
        setShowConfirmDialog(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmProfilePictureChange = async () => {
    try {
      setUpdatingAvatar(true);
      setLoading(true);
      const fileInput = document.querySelector('input[type="file"]');
      const file = fileInput.files[0];

      if (!file) return;

      const formData = new FormData();
      formData.append('avatar', file);

      const response = await usersAPI.updateAvatar(user.id, formData);

      if (response.success) {
        setProfileImage(pendingImage);
        setShowConfirmDialog(false);
        setPendingImage(null);
        toast.success('Profile picture updated successfully');
        
        // Fetch updated user data to get the correct avatar URL from backend
        fetchUserProfile().then(updatedUserData => {
          if (updatedUserData) {
            window.dispatchEvent(new CustomEvent('profile-updated', {
              detail: { user: updatedUserData }
            }));
          }
        });
      }
    } catch (error) {
      toast.error('Failed to update profile picture');
    } finally {
      setUpdatingAvatar(false);
      setLoading(false);
    }
  };

  const cancelProfilePictureChange = () => {
    setShowConfirmDialog(false);
    setPendingImage(null);
  };

  const handleProfileUpdate = async () => {
    try {
      setUpdatingProfile(true);
      setLoading(true);
      const response = await usersAPI.update(user.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone
      });

      if (response.success) {
        toast.success('Profile updated successfully');
        fetchUserProfile();
        
        window.dispatchEvent(new CustomEvent('profile-updated', {
          detail: { user: response.data }
        }));
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setUpdatingProfile(false);
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    // Prevent multiple submissions
    if (changingPassword) return;

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    // Validate new password requirements
    const passwordErrors = [];
    if (passwordData.newPassword.length < 8) {
      passwordErrors.push('at least 8 characters');
    }
    if (!/[A-Z]/.test(passwordData.newPassword)) {
      passwordErrors.push('one uppercase letter');
    }
    if (!/[a-z]/.test(passwordData.newPassword)) {
      passwordErrors.push('one lowercase letter');
    }
    if (!/[0-9]/.test(passwordData.newPassword)) {
      passwordErrors.push('one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordData.newPassword)) {
      passwordErrors.push('one special character');
    }

    if (passwordErrors.length > 0) {
      const errorMessage = `Password must contain: ${passwordErrors.join(', ')}`;
      toast.error(errorMessage);
      return;
    }

    setChangingPassword(true);
    setLoading(true);

    try {
      const response = await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.success) {
        toast.success('Password changed successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {

      // Since frontend validation prevents validation errors from reaching backend,
      // only show non-validation related errors here
      const errorMessage = error.response?.data?.message || 'Failed to change password';

      if (error.response?.status === 400 && errorMessage.includes('validation')) {
        // This shouldn't happen if frontend validation is working, but just in case
        toast.error('Password validation error');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setChangingPassword(false);
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const THEME = {
    gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
    gradientText: "bg-clip-text text-transparent bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {loading && <Loading size={80} bg="bg-black/20" />}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative">
            <Avatar
              size="lg"
              src={profileImage}
              fallback={getInitials(`${user?.firstName} ${user?.lastName}`)}
              cacheKey={user?.id}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleProfilePictureChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Change profile picture"
            />
            <button className="absolute bottom-0 right-0 p-1.5 bg-[#C4009A] rounded-full text-white shadow-sm border-2 border-white hover:bg-[#7E006C] transition-colors pointer-events-none">
              <Camera size={12} />
            </button>
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-2xl font-bold text-slate-900">{user?.firstName} {user?.lastName}</h2>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-4">
              <Badge color="brand">{userRole.toUpperCase()}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">First Name</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-[#C4009A] focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-[#C4009A] focus:outline-none"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-500">Email Address</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-[#C4009A] focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Date of Birth</label>
            <input
              type="date"
              value={user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : ''}
              disabled
              className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">NIC Number</label>
            <input
              type="text"
              value={user?.nic || ''}
              disabled
              className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Position</label>
            <input
              type="text"
              value={user?.position?.name || 'N/A'}
              disabled
              className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Status</label>
            <div className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50">
              <Badge color={user?.status === 'active' ? 'success' : 'warning'}>
                {user?.status?.charAt(0).toUpperCase() + user?.status?.slice(1) || 'N/A'}
              </Badge>
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-500">Address</label>
            <textarea
              value={user?.address || ''}
              disabled
              className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
              rows="2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Referral Code</label>
            <input
              type="text"
              value={user?.referralCode || 'N/A'}
              disabled
              className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Employee ID</label>
            <input
              type="text"
              value={user?.employeeId || 'N/A'}
              disabled
              className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleProfileUpdate} disabled={updatingProfile}>
            {updatingProfile ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Change Password</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-[#C4009A] focus:outline-none pr-10"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-[#C4009A] focus:outline-none pr-10"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-[#C4009A] focus:outline-none pr-10"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

        </div>
        <Button onClick={handlePasswordChange} className="mt-6 bg-[#C4009A] text-white hover:bg-[#7E006C] border-none" disabled={changingPassword}>
          {changingPassword ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating Password...
            </>
          ) : (
            'Update Password'
          )}
        </Button>
      </Card>

      {/* Profile Picture Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Change Profile Picture</h3>
            
            {pendingImage && (
              <div className="mb-4">
                <img 
                  src={pendingImage} 
                  alt="New profile picture" 
                  className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-slate-200"
                />
              </div>
            )}
            
            <p className="text-sm text-slate-600 mb-6">Do you want to update your profile picture?</p>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={cancelProfilePictureChange}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmProfilePictureChange}
                disabled={updatingAvatar}
              >
                {updatingAvatar ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
  );
};

export default Profile;
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Lock, Mail, Phone, Calendar, MapPin, Shield, UserPlus, Camera, Upload, X
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const THEME = {
  gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  gradientText: "bg-clip-text text-transparent bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
};

const Register = ({ onRegister }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    nic: '',
    dateOfBirth: '',
    university: '',
    avatar: null
  });
  const [loading, setLoading] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('Avatar file size must be less than 5MB');
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        setError('Avatar must be an image file (JPEG, PNG, WebP, or GIF)');
        return;
      }

      setAvatarFile(file);
      setFormData(prev => ({
        ...prev,
        avatar: file
      }));

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatarPreview(null);
    setAvatarFile(null);
    setFormData(prev => ({
      ...prev,
      avatar: null
    }));
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const validateForm = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Required fields: First Name, Last Name, Email, Password');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    // Password validation matching backend requirements
    const passwordErrors = [];
    if (formData.password.length < 8) {
      passwordErrors.push('at least 8 characters');
    }
    if (!/[A-Z]/.test(formData.password)) {
      passwordErrors.push('one uppercase letter');
    }
    if (!/[a-z]/.test(formData.password)) {
      passwordErrors.push('one lowercase letter');
    }
    if (!/[0-9]/.test(formData.password)) {
      passwordErrors.push('one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password)) {
      passwordErrors.push('one special character');
    }

    if (passwordErrors.length > 0) {
      setError(`Password must contain ${passwordErrors.join(', ')}`);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    startLoading();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { confirmPassword, ...submitData } = formData;

      // Create FormData for file upload
      const formDataToSend = new FormData();
      
      // Add all text fields
      Object.keys(submitData).forEach(key => {
        if (key !== 'avatar') {
          formDataToSend.append(key, submitData[key]);
        }
      });

      // Add avatar file if exists
      if (avatarFile) {
        formDataToSend.append('avatar', avatarFile);
      }

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        body: formDataToSend, // Don't set Content-Type header for FormData
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'Registration failed');
        setLoading(false);
        stopLoading();
        return;
      }

      setSuccess('Registration successful! Redirecting to login...');

      // Call onRegister callback if provided
      if (onRegister) {
        onRegister(data.data.user, data.data.accessToken, data.data.refreshToken);
      } else {
        // Redirect to login after successful registration
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      setError('Failed to connect to server');
      setLoading(false);
      stopLoading();
    } finally {
      stopLoading();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      {/* <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-[#7E006C]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-[#C4009A]/10 rounded-full blur-3xl"></div> */}

      <Card className="w-full max-w-xl md:max-w-2xl p-6 md:p-8 shadow-xl border-t-4 border-[#C4009A] relative z-10 max-h-[90vh] overflow-y-auto mx-4 md:mx-0">
        <div className="text-center mb-6">
          <h1 className={`text-3xl font-bold ${THEME.gradientText} mb-2`}>Fuchsius</h1>
          <p className="text-slate-500 text-sm">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">First Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="John"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Last Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Doe"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="user@fuchsius.com"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+1234567890"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="123 Main St, City"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">NIC</label>
              <input
                type="text"
                name="nic"
                value={formData.nic}
                onChange={handleInputChange}
                placeholder="NIC Number"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Date of Birth</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">University</label>
            <input
              type="text"
              name="university"
              value={formData.university}
              onChange={handleInputChange}
              placeholder="University Name"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Profile Picture (Optional)</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarPreview ? (
                  <div className="relative">
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <Camera size={24} className="text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:border-[#C4009A] hover:bg-[#C4009A]/5 transition-all"
                >
                  <Upload size={16} />
                  <span className="text-sm text-slate-600">
                    {avatarFile ? avatarFile.name : 'Choose Profile Picture'}
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  JPEG, PNG, WebP, or GIF (Max 5MB)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Must contain: 8+ chars, uppercase, lowercase, number, special character
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] focus:ring-1 focus:ring-[#C4009A]/20 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg">
              {success}
            </div>
          )}

          <div className="pt-4 space-y-3">
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              icon={UserPlus}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </div>

          <div className="text-center pt-4 border-t border-slate-200">
            <p className="text-slate-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-[#C4009A] hover:text-[#7E006C] font-medium transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Register;
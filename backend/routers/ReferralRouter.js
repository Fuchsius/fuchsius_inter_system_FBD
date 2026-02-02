const express = require('express');
const {
    getAllReferrals,
    getReferralById,
    createReferral,
    createReferralWithUser,
    createReferralByAdmin,
    updateReferral,
    deleteReferral,
    getMyReferrals,
    getReferralStats
} = require('../controllers/ReferralController');
const { authenticate, authorize } = require('../auth/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Get referral statistics - Admin/HR only
router.get('/stats', authenticate, authorize(['admin', 'hr']), getReferralStats);

// Get all referrals - Admin/HR/PM only
router.get('/', authenticate, authorize(['admin', 'hr', 'pm']), getAllReferrals);

// Get my referrals - All authenticated users (their own referrals)
router.get('/my', authenticate, getMyReferrals);

// Get referral by ID - Admin/HR/PM or own referral
router.get('/:id', authenticate, async (req, res, next) => {
    // Allow access if user is admin/hr/pm or it's their own referral
    if (['admin', 'hr', 'pm'].includes(req.user.role)) {
        return getReferralById(req, res);
    }
    
    // Check if it's their own referral
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
        const referral = await prisma.referral.findUnique({
            where: { id: req.params.id },
            select: { referredByUserId: true }
        });
        
        if (referral && referral.referredByUserId === req.user.id) {
            return getReferralById(req, res);
        }
        
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to check referral permissions'
        });
    }
});

// Create referral - Any authenticated user (self as referrer)
router.post('/', authenticate, createReferral);

// Create referral with new user - Any authenticated user (creates user and referral)
router.post('/with-user', authenticate, upload.single('paymentSlip'), createReferralWithUser);

// Create referral by admin - Admin only (custom referrer and joined user)
router.post('/admin', authenticate, authorize(['admin']), createReferralByAdmin);

// Update referral - Admin only
router.put('/:id', authenticate, authorize(['admin']), updateReferral);

// Delete referral - Admin only
router.delete('/:id', authenticate, authorize(['admin']), deleteReferral);

module.exports = router;
const compatibilityMatrix = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-']
};

const getCompatibleBloodGroups = (recipientBloodGroup) => {
    return compatibilityMatrix[recipientBloodGroup] || [];
};

const canDonateToRecipient = (donorBloodGroup, recipientBloodGroup) => {
    const compatible = compatibilityMatrix[recipientBloodGroup];
    return compatible && compatible.includes(donorBloodGroup);
};

const getEligibleDonationDate = (lastDonationDate) => {
    if (!lastDonationDate) return null;
    
    const last = new Date(lastDonationDate);
    const eligible = new Date(last);
    eligible.setDate(eligible.getDate() + 90); // 90 days minimum gap
    
    return eligible;
};

const isDonorEligible = (lastDonationDate) => {
    if (!lastDonationDate) return true;
    
    const eligibleDate = getEligibleDonationDate(lastDonationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return eligibleDate <= today;
};

const getDaysUntilEligible = (lastDonationDate) => {
    if (!lastDonationDate) return 0;
    
    const eligibleDate = getEligibleDonationDate(lastDonationDate);
    const today = new Date();
    const diffTime = eligibleDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
};

module.exports = {
    getCompatibleBloodGroups,
    canDonateToRecipient,
    isDonorEligible,
    getEligibleDonationDate,
    getDaysUntilEligible
};

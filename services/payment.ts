// PSN Payment Service
// Bridges the frontend with the Stripe Backend

// Determines the backend URL based on environment
const getApiUrl = () => {
  // If we are in local development and not using Vercel Dev, we might point to a specific port
  if (window.location.hostname === 'localhost' && !window.location.port.includes('3000')) {
    return 'http://localhost:4242/api';
  }
  // Standard Vercel deployment / Vercel Dev uses relative /api path
  return '/api'; 
};

export const paymentService = {
  /**
   * Initiates the Stripe Checkout redirection for Certification Exam.
   */
  async processExamPayment(userId: string, email?: string): Promise<void> {
    throw new Error('Payments are disabled: Devoffs is completely free.');
  },

  /**
   * Initiates the Stripe Checkout for Monthly/Yearly Subscription.
   */
  async processSubscription(userId: string, plan: 'monthly' | 'yearly', email?: string): Promise<void> {
    throw new Error('Payments are disabled: Devoffs is completely free.');
  },

  /**
   * Internal helper to call backend
   */
  async _createCheckoutSession(userId: string, email: string | undefined, type: 'exam' | 'subscription', plan?: 'monthly' | 'yearly'): Promise<void> {
    throw new Error('Payments are disabled: Devoffs is completely free.');
  }
};
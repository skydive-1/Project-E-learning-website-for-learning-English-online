import apiClient from '../../../config/api.config';
import { useState, useEffect, useCallback } from 'react';

/**
 * Lấy trạng thái hạn mức AI của người dùng hiện tại
 * Trả về: { usedQuestions, remainingQuestions, resetAt, isUnlimited }
 */
export const getAiQuotaStatus = async () => {
  try {
    const response = await apiClient.get('/chatbot/quota-status');
    return response.data?.data || response.data;
  } catch (error) {
    console.warn('⚠️ Không thể lấy trạng thái quota AI:', error.message);
    return null;
  }
};

/**
 * Lấy thông tin chi tiết quota bao gồm token balance
 */
export const getAiQuotaDetails = async () => {
  try {
    const response = await apiClient.get('/chatbot/quota-details');
    return response.data?.data || response.data;
  } catch (error) {
    console.warn('⚠️ Không thể lấy chi tiết quota AI:', error.message);
    return null;
  }
};

/**
 * Hook để theo dõi quota AI real-time
 */
export const useAiQuota = (initialQuota = null) => {
  const [quota, setQuota] = useState(initialQuota);
  const [loading, setLoading] = useState(!initialQuota);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAiQuotaStatus();
      setQuota(data);
    } catch (error) {
      console.warn('Failed to refresh AI quota:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialQuota) {
      refresh();
    }
  }, [initialQuota, refresh]);

  return { quota, loading, refresh };
};
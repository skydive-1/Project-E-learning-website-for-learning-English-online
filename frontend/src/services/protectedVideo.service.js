import apiClient from '../config/api.config';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

let ticketRequest = null;
let ticketValidUntil = 0;

export const getProtectedPublicVideoUrl = (assetId) => (
  `${API_BASE_URL}/media/video/stream/${encodeURIComponent(assetId)}`
);

/**
 * Cấp/gia hạn cookie HttpOnly dùng chung cho video giao diện. Promise được gom
 * single-flight để Footer và Home không tạo nhiều vé rồi ghi đè lẫn nhau.
 */
export const ensurePublicVideoTicket = async (minimumValiditySeconds = 15) => {
  const minimumValidityMs = Math.max(0, Number(minimumValiditySeconds) || 0) * 1000;
  if (ticketValidUntil - Date.now() > minimumValidityMs) {
    return { expiresIn: Math.ceil((ticketValidUntil - Date.now()) / 1000) };
  }
  if (ticketRequest) return ticketRequest;

  ticketRequest = apiClient.get('/media/video/ticket', { withCredentials: true })
    .then(({ data }) => {
      const expiresIn = Math.max(15, Number(data?.expiresIn) || 60);
      ticketValidUntil = Date.now() + (expiresIn * 1000);
      return { ...data, expiresIn };
    })
    .finally(() => {
      ticketRequest = null;
    });

  return ticketRequest;
};

export const resetPublicVideoTicketCacheForTests = () => {
  ticketRequest = null;
  ticketValidUntil = 0;
};

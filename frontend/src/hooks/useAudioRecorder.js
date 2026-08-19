import { useState, useRef, useEffect, useCallback } from 'react';

export const useAudioRecorder = ({ onAutoStop } = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [lastRecordedBlob, setLastRecordedBlob] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const isStoppingRef = useRef(false);
  const onAutoStopRef = useRef(onAutoStop);

  useEffect(() => {
    onAutoStopRef.current = onAutoStop;
  }, [onAutoStop]);

  // Expose WebAudio API hooks for visualizer
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
      mediaRecorderRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (e) { }
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch (e) { }
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { }
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive" || isStoppingRef.current) {
        resolve(null);
        return;
      }

      isStoppingRef.current = true;

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = audioChunksRef.current.length > 0
          ? new Blob(audioChunksRef.current, { type: mimeType })
          : null;

        // Cleanup audio nodes
        if (sourceNodeRef.current) {
          try { sourceNodeRef.current.disconnect(); } catch (e) { }
          sourceNodeRef.current = null;
        }
        if (analyserRef.current) {
          try { analyserRef.current.disconnect(); } catch (e) { }
          analyserRef.current = null;
        }
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch (e) { }
          audioContextRef.current = null;
        }

        cleanup();
        setIsRecording(false);
        setRecordingTime(0);
        setLastRecordedBlob(audioBlob);
        isStoppingRef.current = false;

        resolve(audioBlob);
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        isStoppingRef.current = false;
        resolve(null);
      }
    });
  }, []);

  const handleAutoStop = useCallback(async () => {
    const blob = await stopRecording();
    if (onAutoStopRef.current && blob) {
      onAutoStopRef.current(blob);
    }
  }, [stopRecording]);

  const startRecording = async () => {
    try {
      cleanup();
      audioChunksRef.current = [];
      setRecordingTime(0);
      setLastRecordedBlob(null);
      isStoppingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup WebAudio analyser for visualizer
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
        sourceNodeRef.current.connect(analyserRef.current);
      }

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        options = { mimeType: 'audio/ogg;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options = { mimeType: 'audio/wav' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      let currentSec = 0;
      timerIntervalRef.current = setInterval(() => {
        currentSec += 1;
        setRecordingTime(currentSec);

        if (currentSec >= 120) {
          // Dừng khi đạt đúng 120s và bảo toàn blob
          handleAutoStop();
        }
      }, 1000);

    } catch (error) {
      console.error("Lỗi khởi động ghi âm Web Audio API:", error);
      alert("Không thể khởi động ghi âm. Vui lòng kiểm tra thiết bị Micro và cấp quyền truy cập ghi âm cho trang web.");
      throw error;
    }
  };

  return {
    isRecording,
    recordingTime,
    lastRecordedBlob,
    startRecording,
    stopRecording,
    analyserRef,
    audioContextRef,
    streamRef
  };
};

export default useAudioRecorder;

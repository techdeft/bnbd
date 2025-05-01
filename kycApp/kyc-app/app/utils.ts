import { UserData, KYCFormData, IDType } from "./types";
import axios from "axios";
import * as faceapi from "face-api.js";

export const API_BASE_URL = "https://praith.com/api";
export const VERIFICATION_STATUS_URL = `${API_BASE_URL}/user/verification-status`;
export const SUBMIT_KYC_URL = `https://praith.com/api/verification`;

// This function will only run on the client side
export const isMobileDevice = (): boolean => {
  // We're safely on the client side now
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

export const confirmKYC = async (token: string): Promise<UserData> => {
  try {
    const response = await axios.get(VERIFICATION_STATUS_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error confirming KYC:", error);
    throw error;
  }
};

// Helper function to strip base64 data URL prefixes while preserving file type
const stripBase64Prefix = (base64String: string | null): string => {
  if (!base64String) return "";

  // Extract the file type from the data URL
  const fileTypeMatch = base64String.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (fileTypeMatch && fileTypeMatch.length >= 3) {
    const fileType = fileTypeMatch[1];
    const base64Data = fileTypeMatch[2];
    return `data:${fileType};base64,${base64Data}`;
  }

  return base64String;
};

export const submitKYC = async (
  token: string | null,
  formData: KYCFormData
) => {
  try {
    console.log("Submitting KYC data...");

    if (!token) {
      throw new Error("Authentication token is required");
    }

    // Clean and format the token
    const cleanToken = token.trim();
    console.log("Raw token:", cleanToken);

    // Ensure token is properly formatted
    const formattedToken = cleanToken.startsWith("Bearer ")
      ? cleanToken
      : `Bearer ${cleanToken}`;

    console.log("Formatted token:", formattedToken);

    const headersList = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: formattedToken,
    };

    // Map the ID type to the correct format for the API
    const idTypeMap: Record<IDType, string> = {
      "National ID": "National ID",
      "Driver's License": "Driver's License",
      Passport: "passport",
      Other: "other",
      Integration: "integration",
    };

    const bodyContent = JSON.stringify({
      id_type: idTypeMap[formData.idType] || "other",
      id_number: formData.idNumber,
      photo: stripBase64Prefix(formData.selfieImage),
      id_image: stripBase64Prefix(formData.idImage),
      voice_print: stripBase64Prefix(formData.voiceRecording),
    });

    console.log("Request headers:", {
      ...headersList,
      Authorization: "Bearer [REDACTED]", // Don't log the full token
    });
    console.log("Request body:", {
      id_type: idTypeMap[formData.idType],
      id_number: formData.idNumber,
      photo_length: stripBase64Prefix(formData.selfieImage)?.length,
      id_image_length: stripBase64Prefix(formData.idImage)?.length,
      voice_print_length: stripBase64Prefix(formData.voiceRecording)?.length,
    });

    const reqOptions = {
      url: "https://praith.com/api/verification",
      method: "POST",
      headers: headersList,
      data: bodyContent,
    };

    const response = await axios.request(reqOptions);
    console.log("KYC submission successful:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("API Error:", {
        status: error.response?.status,
        data: error.response?.data,
        headers: {
          ...error.response?.headers,
          Authorization: "Bearer [REDACTED]", // Don't log the full token
        },
      });
    }
    throw error;
  }
};

export const checkVerificationStatus = async (token: string) => {
  try {
    const response = await axios.get(VERIFICATION_STATUS_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error checking verification status:", error);
    throw error;
  }
};

export const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export async function checkEnvironmentBrightness(
  videoElement: HTMLVideoElement
): Promise<boolean> {
  try {
    // Check if video element is ready and has valid dimensions
    if (
      !videoElement ||
      !videoElement.videoWidth ||
      !videoElement.videoHeight
    ) {
      console.log("Video element not ready:", {
        videoWidth: videoElement?.videoWidth,
        videoHeight: videoElement?.videoHeight,
      });
      return false;
    }

    // Create a canvas to analyze the video frame
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      console.error("Could not get canvas context");
      return false;
    }

    // Set canvas dimensions to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw the current video frame
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate average brightness
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Calculate brightness using the formula: (0.299*R + 0.587*G + 0.114*B)
      const brightness =
        (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      totalBrightness += brightness;
    }

    const averageBrightness = totalBrightness / (data.length / 4);

    // Return true if brightness is above threshold (0.3 is a reasonable threshold)
    return averageBrightness > 0.3;
  } catch (error) {
    console.error("Error checking brightness:", error);
    return false;
  }
}

export async function checkFacePosition(
  videoElement: HTMLVideoElement
): Promise<{
  isCentered: boolean;
  isFullyVisible: boolean;
  message: string;
  isLive: boolean;
}> {
  try {
    // Check if video element is ready and has valid dimensions
    if (
      !videoElement ||
      !videoElement.videoWidth ||
      !videoElement.videoHeight
    ) {
      console.log("Video element not ready for face detection:", {
        videoWidth: videoElement?.videoWidth,
        videoHeight: videoElement?.videoHeight,
      });
      return {
        isCentered: true,
        isFullyVisible: true,
        message: "Camera not ready. Please wait...",
        isLive: false,
      };
    }

    // Load face detection models if not already loaded
    if (!faceapi.nets.TinyFaceDetector) {
      try {
        await faceapi.nets.TinyFaceDetector.loadFromUri("/models");
      } catch (error) {
        console.error("Error loading face detection model:", error);
        return {
          isCentered: true,
          isFullyVisible: true,
          message: "Error loading face detection. Please refresh the page.",
          isLive: false,
        };
      }
    }

    // Create a canvas to analyze the video frame
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        isCentered: true,
        isFullyVisible: true,
        message: "Error initializing face detection.",
        isLive: false,
      };
    }

    // Set canvas dimensions to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw the current video frame
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Detect faces in the video frame
    const detections = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.5,
      })
    );

    if (!detections) {
      return {
        isCentered: true,
        isFullyVisible: true,
        message: "No face detected. Please position your face in the frame.",
        isLive: false,
      };
    }

    // Liveness detection
    const isLive = await checkLiveness(videoElement, canvas, detections);

    return {
      isCentered: true,
      isFullyVisible: true,
      message: isLive
        ? "Face detected and verified"
        : "Please complete the verification steps",
      isLive: isLive.isLive,
    };
  } catch (error) {
    console.error("Error checking face position:", error);
    return {
      isCentered: true,
      isFullyVisible: true,
      message: "Error detecting face. Please try again.",
      isLive: false,
    };
  }
}

interface LivenessResult {
  isLive: boolean;
  progress: number;
  message: string;
  currentTask: "lighting" | "blink" | "smile" | "complete";
  taskStatus: {
    lighting: boolean;
    blink: boolean;
    smile: boolean;
  };
}

async function checkLiveness(
  videoElement: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  detection: faceapi.FaceDetection
): Promise<LivenessResult> {
  try {
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        isLive: false,
        progress: 0,
        message: "Error initializing liveness check",
        currentTask: "lighting",
        taskStatus: {
          lighting: false,
          blink: false,
          smile: false,
        },
      };
    }

    // Check lighting first
    const isBrightEnough = await checkEnvironmentBrightness(videoElement);
    if (!isBrightEnough) {
      return {
        isLive: false,
        progress: 0,
        message: "Please move to a well-lit area",
        currentTask: "lighting",
        taskStatus: {
          lighting: false,
          blink: false,
          smile: false,
        },
      };
    }

    // Get the face region
    const faceBox = detection.box;
    const faceRegion = {
      x: Math.max(0, faceBox.x - 20),
      y: Math.max(0, faceBox.y - 20),
      width: Math.min(canvas.width - faceBox.x, faceBox.width + 40),
      height: Math.min(canvas.height - faceBox.y, faceBox.height + 40),
    };

    // Check for blinking
    const blinkDetected = await checkBlinking(videoElement, canvas, faceRegion);
    if (!blinkDetected) {
      return {
        isLive: false,
        progress: 0.33,
        message: "Please blink your eyes",
        currentTask: "blink",
        taskStatus: {
          lighting: true,
          blink: false,
          smile: false,
        },
      };
    }

    // Check for smiling
    const smileDetected = await checkSmiling(videoElement, canvas, faceRegion);
    if (!smileDetected) {
      return {
        isLive: false,
        progress: 0.66,
        message: "Please smile",
        currentTask: "smile",
        taskStatus: {
          lighting: true,
          blink: true,
          smile: false,
        },
      };
    }

    // All checks passed
    return {
      isLive: true,
      progress: 1,
      message: "Liveness verification complete!",
      currentTask: "complete",
      taskStatus: {
        lighting: true,
        blink: true,
        smile: true,
      },
    };
  } catch (error) {
    console.error("Error in liveness detection:", error);
    return {
      isLive: false,
      progress: 0,
      message: "Error during liveness check",
      currentTask: "lighting",
      taskStatus: {
        lighting: false,
        blink: false,
        smile: false,
      },
    };
  }
}

async function checkBlinking(
  videoElement: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  faceRegion: { x: number; y: number; width: number; height: number }
): Promise<boolean> {
  const context = canvas.getContext("2d");
  if (!context) return false;

  // Capture multiple frames to detect blinking
  const frames = [];
  for (let i = 0; i < 5; i++) {
    context.drawImage(videoElement, 0, 0);
    frames.push(
      context.getImageData(
        faceRegion.x,
        faceRegion.y,
        faceRegion.width,
        faceRegion.height
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Check for significant changes in eye region
  let blinkDetected = false;
  for (let i = 1; i < frames.length; i++) {
    const diff = compareFrames(frames[i - 1], frames[i]);
    if (diff > 0.15) {
      // Higher threshold for blinking
      blinkDetected = true;
      break;
    }
  }

  return blinkDetected;
}

async function checkSmiling(
  videoElement: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  faceRegion: { x: number; y: number; width: number; height: number }
): Promise<boolean> {
  const context = canvas.getContext("2d");
  if (!context) return false;

  // Capture multiple frames to detect smiling
  const frames = [];
  for (let i = 0; i < 5; i++) {
    context.drawImage(videoElement, 0, 0);
    frames.push(
      context.getImageData(
        faceRegion.x,
        faceRegion.y,
        faceRegion.width,
        faceRegion.height
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Check for significant changes in mouth region
  let smileDetected = false;
  for (let i = 1; i < frames.length; i++) {
    const diff = compareFrames(frames[i - 1], frames[i]);
    if (diff > 0.15) {
      smileDetected = true;
      break;
    }
  }

  return smileDetected;
}

function compareFrames(frame1: ImageData, frame2: ImageData): number {
  let diff = 0;
  const data1 = frame1.data;
  const data2 = frame2.data;

  for (let i = 0; i < data1.length; i += 4) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
    diff += (rDiff + gDiff + bDiff) / 3;
  }

  return diff / (data1.length / 4) / 255;
}

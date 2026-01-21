import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons'; 

// Get screen dimensions
const { width: screenWidth } = Dimensions.get('window');

// main app component
export default function App() {
  const [hasPermission, setHasPermission] = useState(null); // camera and speech permission state (true/false/null)
  const [cameraReady, setCameraReady] = useState(false); // camera readiness state
  const [currentMode, setCurrentMode] = useState('passive'); // active mode (read, navigate, passive)
  const [message, setMessage] = useState('Initializing app...'); // message display
  const [isProcessing, setIsProcessing] = useState(false); // loading indicator state
  const cameraRef = useRef(null); // reference to the camera component

  /**
   * udpates the message displayed in the app and optionally speaks it aloud.
   * @param {string} msg - The message to display.
   * @param {boolean} shouldSpeak - Whether the message should be spoken aloud.
   */
  const updateMessage = (msg, shouldSpeak = false) => {
    setMessage(msg);
    if (shouldSpeak) {
      speak(msg);
    }
  };

  // Request camera and speech permissions
  useEffect(() => {
    const requestPermissions = async () => {
      let cameraGranted = false;
      let speechGranted = false;
      let permissionMessage = 'Requesting camera and speech permissions...';
      updateMessage(permissionMessage, false); // Don't speak this initial loading message

      try {
        // Request Camera Permission
        if (Camera && typeof Camera.requestCameraPermissionsAsync === 'function') {
          const cameraStatus = await Camera.requestCameraPermissionsAsync();
          cameraGranted = cameraStatus.status === 'granted';
          console.log('Camera Permission Status:', cameraStatus.status);
        } else {
          console.error('Expo Camera module is not available or not linked correctly.');
          permissionMessage = 'Camera module not found or not functional.';
          setHasPermission(false); 
          updateMessage(permissionMessage, true);
          return; 
        }

        speechGranted = true;

        if (cameraGranted && speechGranted) {
          setHasPermission(true);
          permissionMessage = 'Camera and Speech permissions granted. Select a mode and tap the button.';
          setCurrentMode('passive');
        } else {
          setHasPermission(false);
          permissionMessage = ''; 
          if (!cameraGranted) {
            permissionMessage += 'Camera permission not granted. Please enable it in settings. ';
          }
          if (!speechGranted) {
            permissionMessage += 'Speech permission not granted. Please enable it in settings.';
          }
        }
      } catch (error) {
        console.error('Error during permission request:', error);
        permissionMessage = `Error requesting permissions: ${error.message}.`;
        setHasPermission(false);
      } finally {
        setTimeout(() => {
          updateMessage(permissionMessage, true);
        }, 500); 
      }
    };

    requestPermissions();
  }, []); 


  /**
   * Returns the appropriate prompt for Gemini based on the current mode.
   * @param {string} mode - The current mode of operation: "read", "navigate", or "passive".
   * @returns {string} The prompt for the Gemini API calll.
   */
  const getPromptForMode = (mode) => {
    switch (mode) {
      case 'read':
        return "Extract all readable text from this image. No extra commentary or explanation. Prioritize the most important text.";
      case 'navigate':
        return "Describe the immediate environment for indoor navigation. Identify key objects, obstacles, pathways, and directional cues. Mention any furniture, doors, stairs, changes in floor level, or other significant features. Provide guidance on what's directly in front, to the left, and to the right. Highlight potential hazards or clear paths.";
      case 'passive':
      default:
        return "Describe the scene briefly. Focus on elements that would be helpful for a visually impaired person to navigate or understand their surroundings. For example, if there's text, read it out. If there are obstacles, describe them. Be concise but informative.";
    }
  };

  /**
   * Handles image capture and API call logic.
   */
  const processImage = async () => {
    if (!cameraReady || !cameraRef.current) {
      updateMessage('Camera not ready. Please wait or refresh the app.', true);
      return;
    }

    setIsProcessing(true);
    updateMessage('Analyzing image, please wait...', false); 
    Speech.stop(); 

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7, 
        allowsEditing: false,
        exif: false,
      });

      const base64ImageData = photo.base64;
      const prompt = getPromptForMode(currentMode);

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg", 
                  data: base64ImageData
                }
              }
            ]
          }
        ],
      };

      const apiKey = "{insert here}"; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      let description = 'Could not get a description.';
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        description = result.candidates[0].content.parts[0].text;
      } else {
        description = 'No clear description was generated. Please try again.';
      }

      updateMessage(description, true); 
    } catch (error) {
      console.error('Error during capture or API call:', error);
      const errorMessage = `Failed to get description: ${error.message}. Please try again.`;
      updateMessage(errorMessage, true);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Speaks the given text using Expo Speech.
   * @param {string} text - The text to be spoken.
   */
  const speak = (text) => {
    Speech.stop(); 
    Speech.speak(text, {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
    });
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.messageText}>{message}</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>{message}</Text>
        <Text style={styles.permissionHint}>
          Please check your app settings and ensure both Camera and Microphone (for speech) permissions are enabled.
        </Text>
      </View>
    );
  }

  // return main application UI
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seeing AI: Multi-Mode</Text>

      {/* Top Half - camera preview */}
      <View style={styles.cameraContainer}>
        {Camera ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back" 
            onCameraReady={() => setCameraReady(true)}
          >
            {!cameraReady && (
              <View style={styles.cameraLoadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.cameraLoadingText}>Loading Camera...</Text>
              </View>
            )}
          </CameraView>
        ) : (
          <View style={styles.cameraNotAvailableOverlay}>
            <Ionicons name="camera-off-outline" size={60} color="#ef4444" />
            <Text style={styles.cameraNotAvailableText}>Camera Not Available</Text>
            <Text style={styles.cameraNotAvailableHint}>
              Please ensure Expo Camera is installed and linked correctly.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Half - controls */}
      <View style={styles.bottomControlsContainer}>
        {/* Mode Selection */}
        <View style={styles.modeButtonContainer}>
          <ModeButton
            title="Read"
            iconName="document-text-outline"
            isActive={currentMode === 'read'}
            onPress={() => {
              setCurrentMode('read');
              updateMessage('Mode set to Read. Tap "Read Document" to scan text.', true);
            }}
          />
          <ModeButton
            title="Navigate"
            iconName="walk-outline"
            isActive={currentMode === 'navigate'}
            onPress={() => {
              setCurrentMode('navigate');
              updateMessage('Mode set to Navigate. Tap "Get Navigation Cues" for indoor guidance.', true);
            }}
          />
          <ModeButton
            title="Passive"
            iconName="eye-outline"
            isActive={currentMode === 'passive'}
            onPress={() => {
              setCurrentMode('passive');
              updateMessage('Mode set to Passive. Tap "Describe Environment" for general descriptions.', true);
            }}
          />
        </View>

        {/* Capture Button */}
        <TouchableOpacity
          style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
          onPress={processImage}
          disabled={!cameraReady || isProcessing || !Camera || !Speech} 
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={24} color="white" style={styles.buttonIcon} />
              <Text style={styles.captureButtonText}>
                {currentMode === 'read'
                  ? 'Read Document'
                  : currentMode === 'navigate'
                  ? 'Get Navigation Cues'
                  : 'Describe Environment'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Stop Button */}
        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => {
            Speech.stop(); 
            setIsProcessing(false); 
            updateMessage('Stopped all operations', true);
          }}
        >
          <Ionicons name="stop-circle-outline" size={24} color="white" style={styles.buttonIcon} />
          <Text style={styles.stopButtonText}>Stop</Text>
        </TouchableOpacity>

        {/* Message Box */}
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

// Separate component for Mode Buttons for readability and reusability
const ModeButton = ({ title, iconName, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.modeButton, isActive && styles.modeButtonActive]}
    onPress={onPress}
  >
    <Ionicons name={iconName} size={20} color={isActive ? '#ffffff' : '#4b5563'} style={styles.buttonIcon} />
    <Text style={[styles.modeButtonText, isActive && styles.modeButtonTextActive]}>
      {title}
    </Text>
  </TouchableOpacity>
);

// Stylesheet for the React Native components
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8', 
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 20, 
    paddingHorizontal: 16,
  },
  bottomControlsContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937', 
    marginBottom: 20,
  },
  modeButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8, 
    marginBottom: 15,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb', 
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6', 
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4b5563', 
    marginLeft: 5,
  },
  modeButtonTextActive: {
    color: '#ffffff', 
  },
  cameraContainer: {
    width: screenWidth * 0.9, 
    height: '45%', 
    borderRadius: 15,
    overflow: 'hidden', 
    marginBottom: 10,
    backgroundColor: '#ccc', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  camera: {
    flex: 1,
    width: '100%', 
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLoadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  cameraNotAvailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffebee', 
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cameraNotAvailableText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444', 
    marginTop: 10,
    textAlign: 'center',
  },
  cameraNotAvailableHint: {
    fontSize: 14,
    color: '#dc2626', 
    marginTop: 5,
    textAlign: 'center',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb', 
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    minWidth: screenWidth * 0.7, 
    marginBottom: 15,
  },
  captureButtonDisabled: {
    backgroundColor: '#9ca3af', 
  },
  captureButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626', 
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    minWidth: screenWidth * 0.4, 
    marginBottom: 15,
    alignSelf: 'center',
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 5,
  },
  messageBox: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6', 
    padding: 12,
    borderRadius: 12,
    width: screenWidth * 0.9, 
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 15,
  },
  messageText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#374151', 
    lineHeight: 24,
  },
  permissionHint: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    color: '#ef4444', 
    paddingHorizontal: 20,
  }
});
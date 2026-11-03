import React, {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
} from 'react';

import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
} from 'expo-audio';

const AudioRecordingContext = createContext(null);

export function AudioRecordingProvider({ children }) {
    // This provider stays mounted at the App.js root, so the recorder survives
    // ChatScreen being temporarily replaced by another screen.
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

    const [isRecording, setIsRecording] = useState(false);
    const [isBusy, setIsBusy] = useState(false);

    const operationLock = useRef(false);
    const recordingStartedAt = useRef(null);

    const startRecording = useCallback(async () => {
        if (operationLock.current || isRecording) return false;

        operationLock.current = true;
        setIsBusy(true);

        try {
            const permission =
                await AudioModule.requestRecordingPermissionsAsync();

            if (!permission.granted) {
                throw new Error('Microphone permission was not granted.');
            }

            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: true,
            });

            await recorder.prepareToRecordAsync();
            recorder.record();

            recordingStartedAt.current = Date.now();
            setIsRecording(true);
            return true;
        } catch (error) {
            recordingStartedAt.current = null;
            setIsRecording(false);

            try {
                await setAudioModeAsync({
                    playsInSilentMode: true,
                    allowsRecording: false,
                });
            } catch (modeError) {
                console.warn('Audio mode reset failed:', modeError);
            }

            throw error;
        } finally {
            operationLock.current = false;
            setIsBusy(false);
        }
    }, [recorder, isRecording]);

    const stopRecording = useCallback(async () => {
        if (operationLock.current || !isRecording) return null;

        operationLock.current = true;
        setIsBusy(true);

        try {
            await recorder.stop();

            const uri = recorder.uri;
            const startedAt = recordingStartedAt.current;
            const durationSeconds = Math.max(
                1,
                Math.round((Date.now() - (startedAt || Date.now())) / 1000)
            );

            if (!uri) {
                throw new Error('Recording file was not created.');
            }

            return { uri, durationSeconds };
        } finally {
            recordingStartedAt.current = null;
            setIsRecording(false);

            try {
                await setAudioModeAsync({
                    playsInSilentMode: true,
                    allowsRecording: false,
                });
            } catch (error) {
                console.warn('Audio mode reset failed:', error);
            }

            operationLock.current = false;
            setIsBusy(false);
        }
    }, [recorder, isRecording]);

    const value = {
        isRecording,
        isBusy,
        startRecording,
        stopRecording,
    };

    return (
        <AudioRecordingContext.Provider value={value}>
            {children}
        </AudioRecordingContext.Provider>
    );
}

export function useAudioRecording() {
    const context = useContext(AudioRecordingContext);

    if (!context) {
        throw new Error(
            'useAudioRecording must be used inside AudioRecordingProvider.'
        );
    }

    return context;
}

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Button,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Modal, // Make sure Modal is imported if used
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // If you use icons

// --- Helper Functions (if any used by DropboxFolderPicker itself) ---

const listFolderContents = async (path, accessToken) => {
    try {
        const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: path,
            }),
        });
        if (!response.ok) throw new Error('Failed to list folder contents');
        const data = await response.json();
        return data.entries;
    } catch (error) {
        console.error('Error listing Dropbox folder:', error);
        Alert.alert('Error', 'Could not load folder contents.');
        return [];
    }
};

// --- DropboxFolderPicker Component ---
const DropboxFolderPicker = ({ visible, onClose, onSelectFolder, dropboxAuth }) => {
    const [folderContents, setFolderContents] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (visible && dropboxAuth?.token) {
            loadFolder(''); // Load root folder when modal becomes visible
        }
    }, [visible, dropboxAuth?.token]);

    const loadFolder = async (path) => {
        setIsLoading(true);
        const contents = await listFolderContents(path, dropboxAuth.token);
        setFolderContents(contents);
        setCurrentPath(path);
        setIsLoading(false);
    };

    const handleGoBack = () => {
        if (currentPath === '') return;
        const lastSlashIndex = currentPath.lastIndexOf('/');
        const parentPath = lastSlashIndex === -1 ? '' : currentPath.substring(0, lastSlashIndex);
        loadFolder(parentPath);
    };

  // In DropboxFolderPicker.js
const renderItem = ({ item }) => {
    const isFolder = item['.tag'] === 'folder';

    // Display files as non-selectable/non-navigable items
    if (!isFolder) {
        return (
            <View style={styles.fileItem}> {/* Use a View, not TouchableOpacity, if not clickable */}
                <MaterialCommunityIcons name="file-outline" size={20} color="#B3B3B3" style={{ marginRight: 10 }} />
                <Text style={styles.fileName}>{item.name}</Text>
            </View>
        );
    }

    // For folders: one touchable area for navigating, a separate button for selecting
    return (
        <View style={styles.folderItem}>
            {/* Touchable area for navigating INTO the folder */}
            <TouchableOpacity
                style={styles.folderNavigateArea} // New style for this specific touchable area
                onPress={() => loadFolder(item.path_lower)}
            >
                <MaterialCommunityIcons name="folder" size={20} color="#B3B3B3" style={{ marginRight: 10 }} />
                <Text style={styles.folderName}>{item.name}</Text>
            </TouchableOpacity>

            {/* Separate button for selecting THIS folder */}
            <TouchableOpacity
                style={styles.selectFolderButton}
                onPress={() => onSelectFolder(item)}
            >
                <Text style={styles.selectFolderButtonText}>Select</Text>
            </TouchableOpacity>
        </View>
    );
};

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select Dropbox Folder</Text>
                    <View style={styles.folderNavBar}>
                        <TouchableOpacity onPress={handleGoBack} disabled={currentPath === ''}>
                            <MaterialCommunityIcons name="arrow-left" size={24} color={currentPath === '' ? "#666" : "#FFFFFF"} />
                        </TouchableOpacity>
                        <Text style={styles.currentPathText}>{currentPath || '/'}</Text>
                        <View style={{ width: 24 }} /> {/* Placeholder for alignment */}
                    </View>
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#8420d0" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={folderContents.filter(item => item['.tag'] === 'folder')} // Only show folders for selection
                            renderItem={renderItem}
                            keyExtractor={(item) => item.id}
                            ListEmptyComponent={<Text style={styles.emptyText}>No folders found.</Text>}
                        />
                    )}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// --- Styles for DropboxFolderPicker ---
const styles = StyleSheet.create({
    // Add all relevant styles for DropboxFolderPicker here from your App.js styles
    // I'll include a minimal set, but ensure you move all necessary styles.
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContent: {
        backgroundColor: '#282828',
        borderRadius: 12,
        padding: 20,
        width: '85%',
        maxHeight: '70%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 20,
        textAlign: 'center',
    },
    folderItem: { // This is the container for each folder row
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10, // Adjust padding as needed
        borderBottomWidth: 1,
        borderBottomColor: '#404040',
        justifyContent: 'space-between', // Pushes the select button to the right
    },
    folderName: { // Ensure this style exists and applies to the folder name text
        color: '#FFFFFF',
        fontSize: 16,
    },
    closeButton: {
        backgroundColor: '#FF453A',
        borderRadius: 8,
        padding: 15,
        marginTop: 20,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        color: '#B3B3B3',
    },
    folderNavBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#404040',
    },
    currentPathText: {
        color: '#FFFFFF',
        fontSize: 16,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    selectFolderButton: {
        backgroundColor: '#1DB954',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 10,
    },
    selectFolderButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
     folderNavigateArea: { // This is the touchable area for the folder name + icon
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1, // Allows it to take up available space, pushing the button right
        paddingVertical: 5, // Gives a bit more touchable area vertically
    },
    fileItem: { // Style for displaying files (non-clickable)
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#404040',
    },
    fileName: { // Style for file names
        color: '#B3B3B3', // Slightly muted color for files
        fontSize: 16,
    },
});

export default DropboxFolderPicker;
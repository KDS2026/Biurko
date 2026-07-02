/**
 * Storage layer using IndexedDB for notes and handwriting learning data.
 */
const DB_NAME = 'NotesAppDB';
const DB_VERSION = 2;

class NotesStorage {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('notes')) {
                    const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
                    notesStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                if (!db.objectStoreNames.contains('handwriting')) {
                    db.createObjectStore('handwriting', { keyPath: 'id', autoIncrement: true });
                }

                if (!db.objectStoreNames.contains('corrections')) {
                    const corrStore = db.createObjectStore('corrections', { keyPath: 'id', autoIncrement: true });
                    corrStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('orgs')) {
                    const orgsStore = db.createObjectStore('orgs', { keyPath: 'id' });
                    orgsStore.createIndex('campaign', 'campaign', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // ===== Notes CRUD =====

    async saveNote(note) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('notes', 'readwrite');
            const store = tx.objectStore('notes');
            store.put(note);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getNote(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('notes', 'readonly');
            const store = tx.objectStore('notes');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllNotes() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('notes', 'readonly');
            const store = tx.objectStore('notes');
            const request = store.getAll();
            request.onsuccess = () => {
                const notes = request.result.sort((a, b) => b.createdAt - a.createdAt);
                resolve(notes);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteNote(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('notes', 'readwrite');
            const store = tx.objectStore('notes');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // ===== Handwriting Learning =====

    async saveCorrection(correction) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('corrections', 'readwrite');
            const store = tx.objectStore('corrections');
            store.put({
                ...correction,
                timestamp: Date.now()
            });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllCorrections() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('corrections', 'readonly');
            const store = tx.objectStore('corrections');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ===== Handwriting stroke data for learning =====

    async saveHandwritingData(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('handwriting', 'readwrite');
            const store = tx.objectStore('handwriting');
            store.put(data);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getHandwritingData() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('handwriting', 'readonly');
            const store = tx.objectStore('handwriting');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ===== Outreach organizations CRUD =====

    async saveOrg(org) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('orgs', 'readwrite');
            const store = tx.objectStore('orgs');
            store.put(org);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllOrgs() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('orgs', 'readonly');
            const store = tx.objectStore('orgs');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteOrg(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('orgs', 'readwrite');
            const store = tx.objectStore('orgs');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }
}

const storage = new NotesStorage();

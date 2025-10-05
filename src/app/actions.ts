"use server";

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { Location, LocationData } from '@/types';

export async function saveLocation(location: LocationData) {
  try {
    const docRef = await addDoc(collection(db, 'locations'), {
      ...location,
      createdAt: Timestamp.now(),
    });
    revalidatePath('/');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error saving location: ", error);
    return { success: false, error: 'Failed to save location. Please check your Firebase setup and permissions.' };
  }
}

export async function getLocations(): Promise<Location[]> {
  try {
    const q = query(collection(db, 'locations'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const locations: Location[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      locations.push({ 
        id: doc.id,
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
      });
    });
    return locations;
  } catch (error) {
    console.error("Error getting locations: ", error);
    return [];
  }
}

export async function deleteLocation(id: string) {
  try {
    await deleteDoc(doc(db, 'locations', id));
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Error deleting location: ", error);
    return { success: false, error: 'Failed to delete location.' };
  }
}


import { BusinessPlan, BusinessCategory } from '../types';

const API_URL = '/api/tariffs';

export const fetchPlans = async (): Promise<BusinessPlan[]> => {
    const response = await fetch(`${API_URL}/plans`);
    if (!response.ok) throw new Error('Error fetching plans');
    return response.json();
};

export const fetchCategories = async (): Promise<any[]> => {
    const response = await fetch(`${API_URL}/categories`);
    if (!response.ok) throw new Error('Error fetching categories');
    return response.json();
};

export const createPlan = async (plan: Partial<BusinessPlan>): Promise<BusinessPlan> => {
    const response = await fetch(`${API_URL}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
    });
    if (!response.ok) throw new Error('Error creating plan');
    return response.json();
};

export const updatePlan = async (id: string, plan: Partial<BusinessPlan>): Promise<BusinessPlan> => {
    const response = await fetch(`${API_URL}/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
    });
    if (!response.ok) throw new Error('Error updating plan');
    return response.json();
};

export const deletePlan = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/plans/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting plan');
};

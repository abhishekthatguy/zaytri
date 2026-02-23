import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BrandsTab from '../BrandsTab';
import * as api from '@/lib/api';
import React from 'react';

// Mock the API calls
vi.mock('@/lib/api', () => ({
    listBrands: vi.fn(),
    getGoogleDriveConfig: vi.fn(),
    listKnowledgeSources: vi.fn(),
    deleteBrand: vi.fn(),
    deleteKnowledgeSource: vi.fn(),
}));

describe('BrandsTab Delete Functionality', () => {
    const mockOnToast = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock responses
        (api.listBrands as any).mockResolvedValue([
            { id: 'brand-1', brand_name: 'Test Brand' }
        ]);
        (api.getGoogleDriveConfig as any).mockResolvedValue(null);
        (api.listKnowledgeSources as any).mockResolvedValue([
            { id: 'source-1', name: 'Test Source', source_type: 'website' }
        ]);
    });

    test('should show confirmation modal when deleting a brand', async () => {
        render(<BrandsTab onToast={mockOnToast} />);

        // Wait for brands to load
        await waitFor(() => {
            expect(screen.getByText('Test Brand')).toBeInTheDocument();
        });

        // Click delete icon (assuming we added a data-testid or can find it by some means)
        // Since it's an icon, we'll find the button containing it. The tooltip says "Delete Brand"
        const deleteButton = screen.getByLabelText('Delete Brand') || screen.getAllByRole('button').find(b => b.innerHTML.includes('Delete Brand'));

        if (deleteButton) fireEvent.click(deleteButton);

        // Modal should appear
        expect(screen.getByText('Delete Brand Profile')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete this brand profile/i)).toBeInTheDocument();
    });

    test('should not delete brand if cancel is clicked on modal', async () => {
        render(<BrandsTab onToast={mockOnToast} />);

        await waitFor(() => {
            expect(screen.getByText('Test Brand')).toBeInTheDocument();
        });

        const deleteButton = screen.getByLabelText('Delete Brand') || screen.getAllByRole('button').find(b => b.innerHTML.includes('Delete Brand'));
        if (deleteButton) fireEvent.click(deleteButton);

        // Click Cancel
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        // Modal should close, brand should still be there, API should not be called
        expect(screen.queryByText('Delete Brand Profile')).not.toBeInTheDocument();
        expect(screen.getByText('Test Brand')).toBeInTheDocument();
        expect(api.deleteBrand).not.toHaveBeenCalled();
    });

    test('should delete brand if confirmed on modal', async () => {
        (api.deleteBrand as any).mockResolvedValue({});

        render(<BrandsTab onToast={mockOnToast} />);

        await waitFor(() => {
            expect(screen.getByText('Test Brand')).toBeInTheDocument();
        });

        const deleteButton = screen.getByLabelText('Delete Brand') || screen.getAllByRole('button').find(b => b.innerHTML.includes('Delete Brand'));
        if (deleteButton) fireEvent.click(deleteButton);

        // Click Yes, Delete
        const confirmButton = screen.getByText('Yes, Delete');
        fireEvent.click(confirmButton);

        // API should be called, brand should be removed from UI
        await waitFor(() => {
            expect(api.deleteBrand).toHaveBeenCalledWith('brand-1');
            expect(screen.queryByText('Test Brand')).not.toBeInTheDocument();
        });
    });
});

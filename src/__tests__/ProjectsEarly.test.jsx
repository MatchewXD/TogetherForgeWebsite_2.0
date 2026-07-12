import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectsEarly from '../pages/ProjectsEarly';

// Basic smoke test – ensures the page renders without crashing
describe('ProjectsEarly page', () => {
    it('renders the Early Game header', () => {
        render(
            <MemoryRouter>
                <ProjectsEarly />
            </MemoryRouter>
        );
        expect(screen.getByText(/EARLY GAME/i)).toBeInTheDocument();
    });
});
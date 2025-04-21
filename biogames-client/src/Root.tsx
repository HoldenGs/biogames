import { useEffect } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';

import './Styles.css';

function Root() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'BioGames';
        // On first load, if we have no hash segment, redirect to /menu
        const hash = window.location.hash;
        if (location.pathname === '/' && (hash === '' || hash === '#' || hash === '#/')) {
            navigate('/menu', { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run only once on mount

    return (
        <Outlet/>
    );
}

export default Root;

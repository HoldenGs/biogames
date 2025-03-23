import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

import './Styles.css';

function Root() {
    const location = useLocation();

    useEffect(() => {
        document.title = 'BioGames';
    });

    if (location.pathname === '/') {
        return (<Navigate to="/menu"/>);
    }

    return (
        <Outlet/>
    );
}

export default Root;

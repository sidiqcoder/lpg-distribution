import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, RequireRole } from './auth';
import ScrollToTop from './components/ScrollToTop';
const Home = lazy(() => import('./pages/Home'));
const DriverLogin = lazy(() => import('./pages/DriverLogin'));
const ManagerLogin = lazy(() => import('./pages/ManagerLogin'));

import DriverLayout from './pages/driver/Layout';
const DriverOverview = lazy(() => import('./pages/driver/Overview'));
const DriverProfile = lazy(() => import('./pages/driver/Profile'));
const DriverMap = lazy(() => import('./pages/driver/MapView'));
const DriverInspectionStatus = lazy(() => import('./pages/driver/InspectionStatus'));
const DriverLpgStatus = lazy(() => import('./pages/driver/LpgStatus'));
const DriverActions = lazy(() => import('./pages/driver/Actions'));
const DriverInspectionForm = lazy(() => import('./pages/driver/InspectionForm'));
const DriverLpgRequest = lazy(() => import('./pages/driver/LpgRequest'));
const DriverOnDuty = lazy(() => import('./pages/driver/OnDuty'));
const DriverRouteMap = lazy(() => import('./pages/driver/RouteMap'));
const DriverCertificate = lazy(() => import('./pages/driver/Certificate'));

import ManagerLayout from './pages/manager/Layout';
const ManagerOverview = lazy(() => import('./pages/manager/Overview'));
const ManagerTracking = lazy(() => import('./pages/manager/Tracking'));
const ManagerCertificates = lazy(() => import('./pages/manager/Certificates'));
const ManagerInspections = lazy(() => import('./pages/manager/Inspections'));
const ManagerDeliveries = lazy(() => import('./pages/manager/Deliveries'));
const ManagerStock = lazy(() => import('./pages/manager/Stock'));
const ManagerKpi = lazy(() => import('./pages/manager/Kpi'));
const ManagerHazards = lazy(() => import('./pages/manager/Hazards'));
const ManagerReview = lazy(() => import('./pages/manager/Review'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="card loading-card"><div className="spinner" /><p>Memuat halaman...</p></div>}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<DriverLogin />} />
          <Route path="/admin/login" element={<ManagerLogin />} />

          <Route path="/sopir" element={<RequireRole role="driver"><DriverLayout /></RequireRole>}>
            <Route index element={<DriverOverview />} />
            <Route path="profil" element={<DriverProfile />} />
            <Route path="peta" element={<DriverMap />} />
            <Route path="status-inspeksi" element={<DriverInspectionStatus />} />
            <Route path="status-lpg" element={<DriverLpgStatus />} />
            <Route path="menu" element={<DriverActions />} />
            <Route path="inspeksi-form" element={<DriverInspectionForm />} />
            <Route path="permintaan-lpg" element={<DriverLpgRequest />} />
            <Route path="on-duty" element={<DriverOnDuty />} />
            <Route path="rute-map" element={<DriverRouteMap />} />
            <Route path="sertifikat" element={<DriverCertificate />} />
          </Route>

          <Route path="/manager" element={<RequireRole role="manager"><ManagerLayout /></RequireRole>}>
            <Route index element={<ManagerOverview />} />
            <Route path="pelacakan" element={<ManagerTracking />} />
            <Route path="sertifikat" element={<ManagerCertificates />} />
            <Route path="inspeksi" element={<ManagerInspections />} />
            <Route path="pengiriman" element={<ManagerDeliveries />} />
            <Route path="stok" element={<ManagerStock />} />
            <Route path="kpi" element={<ManagerKpi />} />
            <Route path="bahaya" element={<ManagerHazards />} />
            <Route path="review/:id" element={<ManagerReview />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

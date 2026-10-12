import { Outlet } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth';
import DriverTelemetry from '../../components/DriverTelemetry';
import FatigueMonitor from '../../components/FatigueMonitor';

export default function DriverLayout() {
  const { user } = useAuth();
  return (
    <Layout role="driver" user={user} title="Dashboard Sopir">
      <DriverTelemetry key={user.id} user={user}>
        <FatigueMonitor user={user} />
        <Outlet />
      </DriverTelemetry>
    </Layout>
  );
}

import React from 'react';

function SystemInfo({ node, currentMetrics, formatBytes }) {
  const systemInfo = node.system_info;

  if (!systemInfo) {
    return (
      <div className="card">
        <h3 className="card-header">System Information</h3>
        <p className="text-gray-500">No system information available</p>
      </div>
    );
  }

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-dark-lightest last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value || 'N/A'}</span>
    </div>
  );

  return (
    <div className="card">
      <h3 className="card-header">System Information</h3>
      
      <div className="space-y-4">
        {/* OS Info */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Operating System</h4>
          <div className="bg-dark-lightest rounded p-3">
            <InfoRow label="Platform" value={systemInfo.os?.platform} />
            <InfoRow label="Distribution" value={systemInfo.os?.distro} />
            <InfoRow label="Release" value={systemInfo.os?.release} />
            <InfoRow label="Architecture" value={systemInfo.os?.arch} />
            <InfoRow label="Hostname" value={systemInfo.os?.hostname} />
            <InfoRow label="Kernel" value={systemInfo.os?.kernel} />
          </div>
        </div>

        {/* CPU Info */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Processor</h4>
          <div className="bg-dark-lightest rounded p-3">
            <InfoRow label="Brand" value={systemInfo.cpu?.brand} />
            <InfoRow label="Manufacturer" value={systemInfo.cpu?.manufacturer} />
            <InfoRow label="Speed" value={systemInfo.cpu?.speed ? `${systemInfo.cpu.speed} GHz` : null} />
            <InfoRow label="Cores" value={systemInfo.cpu?.cores} />
            <InfoRow label="Physical Cores" value={systemInfo.cpu?.physicalCores} />
          </div>
        </div>

        {/* Memory Info */}
        {currentMetrics?.memory && (
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Memory</h4>
            <div className="bg-dark-lightest rounded p-3">
              <InfoRow label="Total" value={formatBytes(currentMetrics.memory.total)} />
              <InfoRow label="Used" value={formatBytes(currentMetrics.memory.used)} />
              <InfoRow label="Free" value={formatBytes(currentMetrics.memory.free)} />
              <InfoRow label="Available" value={formatBytes(currentMetrics.memory.available)} />
            </div>
          </div>
        )}

        {/* Disk Info */}
        {currentMetrics?.disk && currentMetrics.disk.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Disks</h4>
            {currentMetrics.disk.map((disk, index) => (
              <div key={index} className="bg-dark-lightest rounded p-3 mb-2">
                <InfoRow label="Mount" value={disk.mount} />
                <InfoRow label="Type" value={disk.type} />
                <InfoRow label="Total" value={formatBytes(disk.size)} />
                <InfoRow label="Used" value={formatBytes(disk.used)} />
                <InfoRow label="Available" value={formatBytes(disk.available)} />
                <div className="flex justify-between py-2">
                  <span className="text-gray-400 text-sm">Usage</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-dark h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          disk.usagePercent > 90 ? 'bg-red-500' :
                          disk.usagePercent > 75 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${disk.usagePercent}%` }}
                      />
                    </div>
                    <span className="text-white text-sm font-medium">{disk.usagePercent}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemInfo;

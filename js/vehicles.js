document.addEventListener('DOMContentLoaded', () => {
    // Note: The `db` variable is expected to be global, initialized by script.js
    // This is a simplification. A more robust app might use a shared module or event system.

    const vehiclesModal = document.getElementById('vehiclesModal');
    const openVehiclesBtn = document.getElementById('vehicles-btn');
    const closeVehiclesBtn = document.getElementById('closeVehiclesModal');

    const vehicleForm = document.getElementById('vehicle-form');
    const vehicleFormTitle = document.getElementById('vehicle-form-title');
    const vehicleNameInput = document.getElementById('vehicle-name');
    const vehicleMakeInput = document.getElementById('vehicle-make');
    const vehicleModelInput = document.getElementById('vehicle-model');
    const editingVehicleIdInput = document.getElementById('editing-vehicle-id');
    const cancelEditBtn = document.getElementById('cancel-edit-vehicle-btn');
    const vehiclesListDiv = document.getElementById('vehicles-list');

    const resetForm = () => {
        vehicleForm.reset();
        editingVehicleIdInput.value = '';
        vehicleFormTitle.textContent = 'Add New Vehicle';
        cancelEditBtn.classList.add('hidden');
    };

    const displayVehicles = () => {
        if (!db) {
            console.error("Database not initialized yet.");
            vehiclesListDiv.innerHTML = '<p class="text-red-500">Database not ready.</p>';
            return;
        }

        const transaction = db.transaction(['vehicles'], 'readonly');
        const store = transaction.objectStore('vehicles');
        const request = store.getAll();

        request.onsuccess = () => {
            const vehicles = request.result;
            vehiclesListDiv.innerHTML = '';
            if (vehicles.length > 0) {
                vehicles.forEach(vehicle => {
                    const vehicleEl = document.createElement('div');
                    vehicleEl.className = 'p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm flex justify-between items-center';
                    vehicleEl.innerHTML = `
                        <div>
                            <p class="font-bold">${vehicle.name}</p>
                            <p class="text-sm text-gray-500">${vehicle.make || ''} ${vehicle.model || ''}</p>
                        </div>
                        <div class="space-x-2">
                            <button data-action="edit-vehicle" data-id="${vehicle.id}" class="text-xs px-2 py-1 bg-yellow-500 text-white rounded">Edit</button>
                            <button data-action="delete-vehicle" data-id="${vehicle.id}" class="text-xs px-2 py-1 bg-red-500 text-white rounded">Delete</button>
                        </div>
                    `;
                    vehiclesListDiv.appendChild(vehicleEl);
                });
            } else {
                vehiclesListDiv.innerHTML = '<p class="text-sm text-gray-500">No vehicles added yet. Add one below.</p>';
            }
        };
        request.onerror = (event) => {
            console.error('Error fetching vehicles:', event.target.error);
            vehiclesListDiv.innerHTML = '<p class="text-red-500">Error loading vehicles.</p>';
        };
    };

    const openModalAndDisplayVehicles = () => {
        displayVehicles();
        resetForm();
        openModalWithAnimation(vehiclesModal);
    };

    openVehiclesBtn.addEventListener('click', openModalAndDisplayVehicles);
    closeVehiclesBtn.addEventListener('click', () => closeModalWithAnimation(vehiclesModal));
    cancelEditBtn.addEventListener('click', resetForm);

    vehicleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const vehicleData = {
            name: vehicleNameInput.value.trim(),
            make: vehicleMakeInput.value.trim(),
            model: vehicleModelInput.value.trim(),
        };

        if (!vehicleData.name) {
            alert("Vehicle name is required.");
            return;
        }

        const transaction = db.transaction(['vehicles'], 'readwrite');
        const store = transaction.objectStore('vehicles');
        let request;
        const editingId = parseInt(editingVehicleIdInput.value, 10);

        if (editingId) {
            vehicleData.id = editingId;
            request = store.put(vehicleData);
        } else {
            request = store.add(vehicleData);
        }

        request.onsuccess = () => {
            displayVehicles();
            resetForm();
        };
        request.onerror = (event) => {
            console.error('Error saving vehicle:', event.target.error);
        };
    });

    vehiclesListDiv.addEventListener('click', (e) => {
        const target = e.target;
        if (!target.matches('button')) return;

        const action = target.dataset.action;
        const id = parseInt(target.dataset.id, 10);

        if (action === 'edit-vehicle') {
            const transaction = db.transaction(['vehicles'], 'readonly');
            const store = transaction.objectStore('vehicles');
            const request = store.get(id);

            request.onsuccess = () => {
                const vehicle = request.result;
                if (vehicle) {
                    vehicleFormTitle.textContent = 'Edit Vehicle';
                    editingVehicleIdInput.value = vehicle.id;
                    vehicleNameInput.value = vehicle.name;
                    vehicleMakeInput.value = vehicle.make;
                    vehicleModelInput.value = vehicle.model;
                    cancelEditBtn.classList.remove('hidden');
                    vehicleNameInput.focus();
                }
            };
        } else if (action === 'delete-vehicle') {
            if (confirm('Are you sure you want to delete this vehicle? This will not delete its associated fuel logs.')) {
                const transaction = db.transaction(['vehicles'], 'readwrite');
                const store = transaction.objectStore('vehicles');
                const request = store.delete(id);

                request.onsuccess = () => {
                    displayVehicles();
                    resetForm();
                };
                request.onerror = (event) => {
                    console.error('Error deleting vehicle:', event.target.error);
                };
            }
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const getFromStorage = (key, defaultValue = []) => {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error(`Error reading from localStorage for key "${key}":`, error);
            return defaultValue;
        }
    };

    const saveToStorage = (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error(`Error saving to localStorage for key "${key}":`, error);
        }
    };

    let fuelTypes = getFromStorage('fuelTypes', ['Petrol (91)', 'Petrol (95)', 'Diesel']);

    const fuelTypesModal = document.getElementById('fuelTypesModal');
    const openFuelTypesBtn = document.getElementById('fuel-types-btn');
    const closeFuelTypesBtn = document.getElementById('closeFuelTypesModal');
    const fuelTypeSelect = document.getElementById('fuel-type-select');
    const fuelTypeForm = document.getElementById('fuel-type-form');
    const fuelTypeFormTitle = document.getElementById('fuel-type-form-title');
    const fuelTypeNameInput = document.getElementById('fuel-type-name');
    const editingFuelTypeNameInput = document.getElementById('editing-fuel-type-name');
    const deleteFuelTypeBtn = document.getElementById('delete-fuel-type-btn');

    const populateDropdown = () => {
        fuelTypeSelect.innerHTML = '<option value="">Select type to edit...</option>';
        fuelTypes.sort().forEach(type => {
            fuelTypeSelect.innerHTML += `<option value="${type}">${type}</option>`;
        });
    };

    const resetForm = () => {
        fuelTypeForm.reset();
        fuelTypeSelect.value = '';
        editingFuelTypeNameInput.value = '';
        fuelTypeFormTitle.textContent = 'Add New Fuel Type';
        deleteFuelTypeBtn.classList.add('hidden');
    };

    openFuelTypesBtn.addEventListener('click', () => {
        fuelTypes = getFromStorage('fuelTypes', ['Petrol (91)', 'Petrol (95)', 'Diesel']);
        populateDropdown();
        resetForm();
        openModalWithAnimation(fuelTypesModal);
    });

    closeFuelTypesBtn.addEventListener('click', () => closeModalWithAnimation(fuelTypesModal));

    fuelTypeSelect.addEventListener('change', () => {
        const selectedType = fuelTypeSelect.value;
        if (!selectedType) {
            resetForm();
            return;
        }
        fuelTypeFormTitle.textContent = 'Edit Fuel Type';
        editingFuelTypeNameInput.value = selectedType;
        fuelTypeNameInput.value = selectedType;
        deleteFuelTypeBtn.classList.remove('hidden');
    });

    fuelTypeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTypeName = fuelTypeNameInput.value.trim();
        const oldTypeName = editingFuelTypeNameInput.value;

        if (!newTypeName) return;

        if (oldTypeName) { // Editing
            if (newTypeName !== oldTypeName) {
                const typeIndex = fuelTypes.indexOf(oldTypeName);
                if (typeIndex > -1) {
                    fuelTypes[typeIndex] = newTypeName;
                }
            }
        } else { // Adding
            if (!fuelTypes.includes(newTypeName)) {
                fuelTypes.push(newTypeName);
            }
        }

        saveToStorage('fuelTypes', fuelTypes);
        populateDropdown();
        resetForm();
    });

    deleteFuelTypeBtn.addEventListener('click', () => {
        const typeToDelete = editingFuelTypeNameInput.value;
        if (typeToDelete && confirm(`Are you sure you want to delete the "${typeToDelete}" type?`)) {
            fuelTypes = fuelTypes.filter(t => t !== typeToDelete);
            saveToStorage('fuelTypes', fuelTypes);
            populateDropdown();
            resetForm();
        }
    });

    // Initial save of default types if it's the first run
    if (!localStorage.getItem('fuelTypes')) {
        saveToStorage('fuelTypes', fuelTypes);
    }
});

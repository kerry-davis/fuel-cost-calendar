let db;
let currentLogId = null; // Used when editing a specific log
let lastEdited = null; // For real-time amount calculation
let originalLogData = null; // For checking for unsaved changes

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let modalCurrentDay = null;
let modalCurrentMonth = null;
let modalCurrentYear = null;
let modalStack = [];

let calendarDays, currentMonthElement, prevMonthButton, nextMonthButton, dayDetailModal, closeModal, modalDate;

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


function setupTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;
    const themeToggleIcon = themeToggleBtn.querySelector('i');
    const updateIcon = (isDark) => {
        if (isDark) {
            themeToggleIcon.classList.remove('fa-sun');
            themeToggleIcon.classList.add('fa-moon');
        } else {
            themeToggleIcon.classList.remove('fa-moon');
            themeToggleIcon.classList.add('fa-sun');
        }
    };
    const toggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateIcon(isDark);
    };
    themeToggleBtn.addEventListener('click', toggleTheme);
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = false;
    if (savedTheme) {
        isDark = savedTheme === 'dark';
    } else {
        isDark = prefersDark;
    }
    if (isDark) {
        document.documentElement.classList.add('dark');
    }
    updateIcon(isDark);
}


function initDB(callback) {
    const request = indexedDB.open("fuelLogDB", 2);

    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        console.log("Upgrading database schema...");

        // Create the new object store for fuel logs if it doesn't exist
        if (!db.objectStoreNames.contains('fuel_logs')) {
            const fuelLogsStore = db.createObjectStore("fuel_logs", { keyPath: "id", autoIncrement: true });
            fuelLogsStore.createIndex("date", "date", { unique: false });
            console.log("'fuel_logs' object store created.");
        }

        // Create the new object store for vehicles
        if (!db.objectStoreNames.contains('vehicles')) {
            const vehiclesStore = db.createObjectStore("vehicles", { keyPath: "id", autoIncrement: true });
            vehiclesStore.createIndex("name", "name", { unique: false });
            console.log("'vehicles' object store created.");
        }

        // Add the vehicleId index to the fuel_logs store
        const transaction = event.target.transaction;
        if (transaction) {
            const fuelLogsStore = transaction.objectStore("fuel_logs");
            if (!fuelLogsStore.indexNames.contains('vehicleId')) {
                fuelLogsStore.createIndex("vehicleId", "vehicleId", { unique: false });
                console.log("Created 'vehicleId' index on 'fuel_logs' store.");
            }
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("Database initialized successfully.");
        if (callback) callback();
    };

    request.onerror = function(event) {
        console.error("Database error: " + event.target.errorCode);
    };
}


function initDOMElements() {
    calendarDays = document.getElementById('calendarDays');
    currentMonthElement = document.getElementById('currentMonth');
    prevMonthButton = document.getElementById('prevMonth');
    nextMonthButton = document.getElementById('nextMonth');
    dayDetailModal = document.getElementById('dayDetailModal');
    closeModal = document.getElementById('closeDayDetailModal');
    modalDate = document.getElementById('modalDate');
}

function initCalendar() {
    initDOMElements();
    setupEventListeners();
    setupTheme();
    initDB(() => {
        renderCalendar();
    });
}

function handleModalClicks(e) {
    if (e.target === dayDetailModal) {
        hideModal();
        return;
    }

    const target = e.target.closest('button');
    if (!target) return;

    const action = target.dataset.action;
    if (!action) return;

    const logId = parseInt(target.dataset.logId, 10);

    if (action === 'edit-log') {
        openFuelLogModal(logId);
    }
}

function setupEventListeners() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => openModalWithAnimation(settingsModal));
    }

    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => closeModalWithAnimation(settingsModal));
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeModalWithAnimation(settingsModal);
            }
        });
    }

    const fuelTypeSelectionModal = document.getElementById('fuelTypeSelectionModal');
    if (fuelTypeSelectionModal) {
        fuelTypeSelectionModal.addEventListener('click', (e) => {
            if (e.target === fuelTypeSelectionModal) {
                closeModalWithAnimation(fuelTypeSelectionModal);
            }
        });
    }

    const doneSelectFuelTypeBtn = document.getElementById('done-select-fuel-type-btn');
    if (doneSelectFuelTypeBtn) {
        doneSelectFuelTypeBtn.addEventListener('click', () => {
            // Logic to handle selection will be added here
            closeModalWithAnimation(document.getElementById('fuelTypeSelectionModal'));
        });
    }

    prevMonthButton.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    });
    nextMonthButton.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
    });
    closeModal.addEventListener('click', hideModal);
    dayDetailModal.addEventListener('click', handleModalClicks);

    // Listeners for real-time amount calculation
    const priceInput = document.getElementById('fuel-log-price');
    const costInput = document.getElementById('fuel-log-cost');
    const amountInput = document.getElementById('fuel-log-amount');
    let lastEdited = null; // Can be 'price', 'cost', or 'amount'

    const recalculateFuelValues = () => {
        const price = parseFloat(priceInput.value) || 0;
        const totalCost = parseFloat(costInput.value) || 0;
        const amount = parseFloat(amountInput.value) || 0;

        if (lastEdited === 'price' || lastEdited === 'cost') {
            if (price > 0 && totalCost > 0) {
                amountInput.value = (totalCost / price).toFixed(2);
            }
        } else if (lastEdited === 'amount') {
            if (amount > 0 && price > 0) {
                costInput.value = (amount * price).toFixed(2);
            } else if (amount > 0 && totalCost > 0) {
                priceInput.value = (totalCost / amount).toFixed(3);
            }
        }
    };

    if(priceInput) {
        priceInput.addEventListener('focus', () => lastEdited = 'price');
        priceInput.addEventListener('input', recalculateFuelValues);
    }
    if(costInput) {
        costInput.addEventListener('focus', () => lastEdited = 'cost');
        costInput.addEventListener('input', recalculateFuelValues);
    }
    if(amountInput) {
        amountInput.addEventListener('focus', () => lastEdited = 'amount');
        amountInput.addEventListener('input', recalculateFuelValues);
    }

    const saveFuelLogBtn = document.getElementById('save-fuel-log-btn');
    if (saveFuelLogBtn) {
        saveFuelLogBtn.addEventListener('click', saveFuelLog);
    }

    const deleteFuelLogBtn = document.getElementById('delete-fuel-log-btn');
    if (deleteFuelLogBtn) {
        deleteFuelLogBtn.addEventListener('click', () => {
            if (currentLogId) {
                deleteFuelLog(currentLogId);
            }
        });
    }

    const exportJsonBtn = document.getElementById('export-json-btn');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => exportData('json'));
    }
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => exportData('csv'));
    }

    const importInput = document.getElementById('import-file-input');
    if (importInput) {
        importInput.addEventListener('change', importData);
    }

    // Analytics Modal Listeners
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analyticsModal');
    const closeAnalyticsModal = document.getElementById('closeAnalyticsModal');

    if (analyticsBtn) {
        analyticsBtn.addEventListener('click', loadAnalytics);
    }

    if (closeAnalyticsModal) {
        closeAnalyticsModal.addEventListener('click', () => closeModalWithAnimation(analyticsModal));
    }

    if (analyticsModal) {
        analyticsModal.addEventListener('click', (e) => {
            if (e.target === analyticsModal) {
                closeModalWithAnimation(analyticsModal);
            }
        });
    }

    // New listener for the "Add Log" button in the day detail modal
    const addLogFromDetailBtn = document.getElementById('add-log-from-detail-btn');
    if (addLogFromDetailBtn) {
        addLogFromDetailBtn.addEventListener('click', () => {
            openFuelLogModal(); // Open modal for a new entry
        });
    }

    const fuelLogModal = document.getElementById('fuelLogModal');
    if (fuelLogModal) {
        const closeBtn = document.getElementById('closeFuelLogModal');
        closeBtn.addEventListener('click', () => closeFuelLogModalWithCheck());
        fuelLogModal.addEventListener('click', (e) => {
            if (e.target === fuelLogModal) {
                closeFuelLogModalWithCheck();
            }
        });
    }

    // Swipe gestures for calendar
    const calendarContainer = document.querySelector('#calendarDays');
    if (calendarContainer) {
        addSwipeListeners(calendarContainer,
            () => { // onSwipeLeft
                currentMonth++;
                if (currentMonth > 11) { currentMonth = 0; currentYear++; }
                renderCalendar();
            },
            () => { // onSwipeRight
                currentMonth--;
                if (currentMonth < 0) { currentMonth = 11; currentYear--; }
                renderCalendar();
            }
        );
    }

    // Swipe gestures for modal
    if (dayDetailModal) {
        const modalContent = dayDetailModal.querySelector('.relative');
        if (modalContent) {
            // addSwipeListeners(modalContent, showNextDay, showPreviousDay); // These functions don't exist yet
        }
    }
}

function checkIfLogsExist(date, callback) {
    if (!db) {
        callback(false);
        return;
    }
    const transaction = db.transaction(["fuel_logs"], "readonly");
    const objectStore = transaction.objectStore("fuel_logs");
    const index = objectStore.index("date");
    const request = index.count(date);

    request.onsuccess = () => {
        callback(request.result > 0);
    };
    request.onerror = (event) => {
        console.error("Error checking for logs:", event.target.error);
        callback(false);
    };
}

// Generic modal handlers
function openModalWithAnimation(modal) {
    if (!modal) return;

    // If there's an active modal, cover its content
    if (modalStack.length > 0) {
        const currentModal = modalStack[modalStack.length - 1];
        if (currentModal && currentModal.firstElementChild) {
            currentModal.firstElementChild.classList.add('modal-content-covered');
        }
    }

    modalStack.push(modal);

    document.body.classList.add('modal-open');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('is-visible');
    }, 10);

    const scrollContainer = modal.querySelector('.overflow-y-auto');
    if (scrollContainer) {
        setTimeout(() => {
            scrollContainer.scrollTop = 0;
        }, 0);
    }
}

function closeModalWithAnimation(modal) {
    if (!modal) return;

    // Remove the closed modal from the stack
    modalStack = modalStack.filter(m => m !== modal);

    // Uncover the new top modal, if it exists
    if (modalStack.length > 0) {
        const newTopModal = modalStack[modalStack.length - 1];
        if (newTopModal && newTopModal.firstElementChild) {
            newTopModal.firstElementChild.classList.remove('modal-content-covered');
        }
    }

    // Only remove the body class if no modals are left open
    if (modalStack.length === 0) {
        document.body.classList.remove('modal-open');
    }

    modal.classList.remove('is-visible');
    const onTransitionEnd = (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            modal.removeEventListener('transitionend', onTransitionEnd);
        }
    };
    modal.addEventListener('transitionend', onTransitionEnd);
}

function showModal(day, month, year) {
    modalCurrentDay = day;
    modalCurrentMonth = month;
    modalCurrentYear = year;
    const dateObj = new Date(year, month, day);
    const dayName = dayNames[dateObj.getDay()];
    const monthName = monthNames[month];
    modalDate.textContent = `${dayName}, ${monthName} ${day}, ${year}`;

    displayFuelLogsForDay(year, month, day);

    openModalWithAnimation(dayDetailModal);
}

function hideModal() {
    closeModalWithAnimation(dayDetailModal);
    modalCurrentDay = null;
    modalCurrentMonth = null;
    modalCurrentYear = null;
}

async function renderCalendar() {
    const render = async () => {
        currentMonthElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        calendarDays.innerHTML = '';

        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

        const loggedDays = await getLoggedDaysForMonth(firstDayOfMonth, lastDayOfMonth);

        let firstDay = firstDayOfMonth.getDay();
        firstDay = (firstDay === 0) ? 6 : firstDay - 1; // Adjust to Monday start
        const daysInMonth = lastDayOfMonth.getDate();

        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day';
            calendarDays.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day border-gray-200 dark:border-gray-700 border rounded flex flex-col items-center justify-center relative';

            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            dayElement.appendChild(dayNumber);

            if (loggedDays.has(day)) {
                const dayInfo = loggedDays.get(day);
                const logIndicator = document.createElement('span');
                logIndicator.className = 'log-indicator';

                let iconClass = '';
                if (dayInfo.hasFuelLog) {
                    iconClass = 'fas fa-gas-pump';
                } else if (dayInfo.hasOdometerLog) {
                    iconClass = 'fas fa-car';
                }

                if (iconClass) {
                    logIndicator.innerHTML = `<i class="${iconClass}"></i>`;
                    dayElement.appendChild(logIndicator);
                }
            }

            if (currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth() && day === new Date().getDate()) {
                dayElement.classList.add('ring-2', 'ring-calendar-green');
            }

            dayElement.addEventListener('click', () => showModal(day, currentMonth, currentYear));
            calendarDays.appendChild(dayElement);
        }

        // Apply fade-in and clean up min-height
        calendarDays.classList.add('fade-in');
        calendarDays.addEventListener('animationend', () => {
            calendarDays.classList.remove('fade-in');
            calendarDays.style.minHeight = ''; // Clean up inline style
        }, { once: true });
    };

    // If the calendar already has children, fade out before re-rendering
    if (calendarDays.children.length > 0) {
        const currentHeight = calendarDays.offsetHeight;
        calendarDays.style.minHeight = `${currentHeight}px`; // Set fixed height
        calendarDays.classList.add('fade-out');

        calendarDays.addEventListener('animationend', async () => {
            calendarDays.classList.remove('fade-out');
            await render();
        }, { once: true });
    } else {
        // Initial render, just fade in
        await render();
    }
}




async function openFuelLogModal(logId = null) {
    const fuelLogModal = document.getElementById('fuelLogModal');
    const formTitle = document.getElementById('fuel-log-form-title');
    const deleteBtn = document.getElementById('delete-fuel-log-btn');
    const vehicleSelect = document.getElementById('fuel-log-vehicle');

    // Reset form
    document.getElementById('fuel-log-form').reset();
    currentLogId = logId;

    // Populate vehicles dropdown
    const vehicles = await getAllData('vehicles');
    if (vehicles.length === 0) {
        alert("Please add a vehicle first in the 'My Vehicles' section.");
        return;
    }
    vehicleSelect.innerHTML = vehicles.map(v => `<option value="${v.id}">${v.name}</option>`).join('');

    // Populate fuel types dropdown
    const fuelTypeSelect = document.getElementById('fuel-log-type');
    const fuelTypes = JSON.parse(localStorage.getItem('fuelTypes') || '["Petrol (91)", "Petrol (95)", "Diesel"]');
    fuelTypeSelect.innerHTML = fuelTypes.map(type => `<option value="${type}">${type}</option>`).join('');

    if (logId) {
        formTitle.textContent = 'Edit Fill-up';
        deleteBtn.classList.remove('hidden');
        const transaction = db.transaction(['fuel_logs'], 'readonly');
        const store = transaction.objectStore('fuel_logs');
        const request = store.get(logId);

        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                // If price and cost are available, but no amount, derive it for display.
                if (data.price > 0 && data.totalCost > 0 && !data.amount) {
                    data.amount = parseFloat((data.totalCost / data.price).toFixed(2));
                }
                vehicleSelect.value = data.vehicleId;
                fuelTypeSelect.value = data.fuelType;
                document.getElementById('fuel-log-price').value = data.price;
                document.getElementById('fuel-log-cost').value = data.totalCost;
                document.getElementById('fuel-log-amount').value = data.amount;
                document.getElementById('fuel-log-odometer').value = data.odometer;
                document.getElementById('fuel-log-notes').value = data.notes;

                originalLogData = { ...data }; // Store a copy
            }
        };
    } else {
        formTitle.textContent = 'Log a New Fill-up';
        deleteBtn.classList.add('hidden');
        lastEdited = null; // For new logs, allow auto-calculation
        originalLogData = {}; // For new logs, the original data is empty
    }
    openModalWithAnimation(fuelLogModal);
}

function getFuelLogFormData() {
    return {
        vehicleId: parseInt(document.getElementById('fuel-log-vehicle').value, 10),
        fuelType: document.getElementById('fuel-log-type').value,
        price: parseFloat(document.getElementById('fuel-log-price').value) || 0,
        totalCost: parseFloat(document.getElementById('fuel-log-cost').value) || 0,
        amount: parseFloat(document.getElementById('fuel-log-amount').value) || 0,
        odometer: parseInt(document.getElementById('fuel-log-odometer').value, 10) || 0,
        notes: document.getElementById('fuel-log-notes').value.trim(),
    };
}

function hasFormChanged() {
    if (!originalLogData) return false;
    const currentData = getFuelLogFormData();

    // For new logs, check if any field has been filled
    if (!originalLogData.id) {
        return Object.values(currentData).some(val => !!val);
    }

    // For existing logs, compare field by field
    return (
        currentData.vehicleId !== originalLogData.vehicleId ||
        currentData.fuelType !== originalLogData.fuelType ||
        currentData.price !== originalLogData.price ||
        currentData.totalCost !== originalLogData.totalCost ||
        currentData.amount !== originalLogData.amount ||
        currentData.odometer !== originalLogData.odometer ||
        currentData.notes !== originalLogData.notes
    );
}

function closeFuelLogModalWithCheck() {
    const fuelLogModal = document.getElementById('fuelLogModal');
    if (hasFormChanged()) {
        if (confirm("You have unsaved changes. Do you want to save them before closing?")) {
            saveFuelLog(); // This already closes the modal on success
        } else {
            closeModalWithAnimation(fuelLogModal);
        }
    } else {
        closeModalWithAnimation(fuelLogModal);
    }
}

function saveFuelLog() {
    const vehicleId = parseInt(document.getElementById('fuel-log-vehicle').value, 10);
    if (!vehicleId) {
        alert("Please select a vehicle.");
        return;
    }

    const fuelLogData = {
        date: `${modalCurrentYear}-${(modalCurrentMonth + 1).toString().padStart(2, '0')}-${modalCurrentDay.toString().padStart(2, '0')}`,
        vehicleId: vehicleId,
        fuelType: document.getElementById('fuel-log-type').value,
        price: parseFloat(document.getElementById('fuel-log-price').value) || 0,
        totalCost: parseFloat(document.getElementById('fuel-log-cost').value) || 0,
        amount: parseFloat(document.getElementById('fuel-log-amount').value) || 0,
        odometer: parseInt(document.getElementById('fuel-log-odometer').value, 10) || 0,
        notes: document.getElementById('fuel-log-notes').value.trim(),
    };

    // If price and cost are entered, but no amount, derive it.
    if (fuelLogData.price > 0 && fuelLogData.totalCost > 0 && !fuelLogData.amount) {
        fuelLogData.amount = parseFloat((fuelLogData.totalCost / fuelLogData.price).toFixed(2));
    }

    if (!fuelLogData.totalCost && !fuelLogData.amount && !fuelLogData.odometer) {
        alert("Please enter at least the total cost, fuel amount, or an odometer reading.");
        return;
    }

    const transaction = db.transaction(['fuel_logs'], 'readwrite');
    const store = transaction.objectStore('fuel_logs');
    let request;

    if (currentLogId) {
        fuelLogData.id = currentLogId;
        request = store.put(fuelLogData);
    } else {
        request = store.add(fuelLogData);
    }

    request.onsuccess = () => {
        console.log("Fuel log saved successfully.");
        closeModalWithAnimation(document.getElementById('fuelLogModal'));
        displayFuelLogsForDay(modalCurrentYear, modalCurrentMonth, modalCurrentDay);
        renderCalendar(); // To update indicators
    };

    request.onerror = (event) => {
        console.error("Error saving fuel log:", event.target.error);
    };
}

function deleteFuelLog(logId) {
    if (!confirm('Are you sure you want to delete this fuel log?')) {
        return;
    }

    const transaction = db.transaction(['fuel_logs'], 'readwrite');
    const store = transaction.objectStore('fuel_logs');
    const request = store.delete(logId);

    request.onsuccess = () => {
        console.log("Fuel log deleted successfully.");
        closeModalWithAnimation(document.getElementById('fuelLogModal'));
        displayFuelLogsForDay(modalCurrentYear, modalCurrentMonth, modalCurrentDay);
        renderCalendar();
    };

    request.onerror = (event) => {
        console.error('Error deleting fuel log:', event.target.error);
    };
}

async function displayFuelLogsForDay(year, month, day) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    const vehicles = await getAllData('vehicles');
    const vehicleMap = new Map(vehicles.map(v => [v.id, v.name]));

    const transaction = db.transaction(['fuel_logs'], 'readonly');
    const store = transaction.objectStore('fuel_logs');
    const index = store.index('date');
    const request = index.getAll(dateStr);

    const logListEl = document.getElementById('day-log-list');
    logListEl.innerHTML = '';

    request.onsuccess = () => {
        const logs = request.result;
        if (logs.length > 0) {
            logs.forEach(log => {
                const logEl = document.createElement('div');
                logEl.className = 'p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm text-sm';
                const vehicleName = vehicleMap.get(log.vehicleId) || 'Unknown Vehicle';
                let content = `<div class="flex justify-between items-center">
                                 <div>
                                    <span class="font-bold text-base">${log.fuelType}</span>
                                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">(${vehicleName})</span>
                                 </div>
                                 <button data-action="edit-log" data-log-id="${log.id}" class="text-xs px-2 py-1 bg-accent text-white rounded">Edit</button>
                               </div>`;
                content += `<p class="mt-2"><strong>Total Cost:</strong> $${log.totalCost.toFixed(2)}</p>`;
                if (log.amount > 0) content += `<p><strong>Amount:</strong> ${log.amount} L</p>`;
                if (log.price > 0) content += `<p><strong>Price:</strong> $${log.price.toFixed(3)} / L</p>`;
                if (log.odometer > 0) content += `<p><strong>Odometer:</strong> ${log.odometer} km</p>`;
                if (log.notes) content += `<p class="mt-1 italic"><strong>Notes:</strong> ${log.notes}</p>`;

                logEl.innerHTML = content;
                logListEl.appendChild(logEl);
            });
        } else {
            logListEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No fill-ups logged for this day.</p>';
        }
    };

    request.onerror = (event) => {
        logListEl.innerHTML = '<p class="text-red-500">Error loading logs.</p>';
        console.error('Error fetching logs for day:', event.target.error);
    };
}

function getLoggedDaysForMonth(startDate, endDate) {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.warn("DB not initialized, resolving with empty map.");
            resolve(new Map());
            return;
        }
        const transaction = db.transaction(["fuel_logs"], "readonly");
        const objectStore = transaction.objectStore("fuel_logs");
        const index = objectStore.index("date");

        const startStr = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}`;
        const endStr = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}`;
        const range = IDBKeyRange.bound(startStr, endStr);

        const request = index.getAll(range);
        const loggedDays = new Map();

        request.onsuccess = () => {
            request.result.forEach(log => {
                if (!log || !log.date) return;

                const day = parseInt(log.date.split('-')[2], 10);
                if (!loggedDays.has(day)) {
                    loggedDays.set(day, { hasFuelLog: false, hasOdometerLog: false });
                }

                const dayInfo = loggedDays.get(day);
                const isOdometerOnly = log.odometer > 0 && !log.totalCost && !log.price && !log.amount;

                if (isOdometerOnly) {
                    dayInfo.hasOdometerLog = true;
                } else {
                    dayInfo.hasFuelLog = true;
                }
            });
            resolve(loggedDays);
        };

        request.onerror = (event) => {
            console.error("Error fetching logged days for month:", event.target.error);
            reject(event.target.error);
        };
    });
}

function getAllData(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("DB not initialized");
            return;
        }
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function exportData(format = 'json') {
    const logs = await getAllData('fuel_logs');
    if (logs.length === 0) {
        alert("No data to export.");
        return;
    }

    let dataStr;
    let filename;

    // Generate timestamp
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timestamp = `${year}_${month}-${day}_${hours}${minutes}`;

    if (format === 'json') {
        const exportObject = {
            fuel_logs: logs,
            fuel_types: JSON.parse(localStorage.getItem('fuelTypes') || '[]')
        };
        dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
        filename = `fuel_log_export_${timestamp}.json`;
    } else { // csv
        const header = "id,date,fuelType,price,totalCost,amount,odometer,notes\n";
        const rows = logs.map(log => {
            const notes = `"${(log.notes || '').replace(/"/g, '""')}"`; // Escape double quotes
            return `${log.id},${log.date},${log.fuelType},${log.price},${log.totalCost},${log.amount},${log.odometer},${notes}`;
        }).join("\n");
        const csvContent = header + rows;
        dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        filename = `fuel_log_export_${timestamp}.csv`;
    }

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    console.log(`Data exported as ${format}.`);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const filename = file.name;
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (typeof data !== 'object' || data === null || !data.fuel_logs) {
                 throw new Error("Invalid data format. Expecting a JSON file with a 'fuel_logs' property.");
            }

            const confirmed = confirm(`Are you sure you want to import data from "${filename}"? This will overwrite ALL existing log data and fuel types.`);
            if (confirmed) {
                // Import fuel types
                if (data.fuel_types && Array.isArray(data.fuel_types)) {
                    localStorage.setItem('fuelTypes', JSON.stringify(data.fuel_types));
                }

                // Clear and import fuel logs
                const transaction = db.transaction(['fuel_logs'], "readwrite");
                const store = transaction.objectStore('fuel_logs');
                const clearRequest = store.clear();

                clearRequest.onsuccess = () => {
                    console.log("Old fuel logs cleared. Starting import...");
                    let importCount = 0;
                    data.fuel_logs.forEach(log => {
                        // The `put` method will respect the `id` from the import file if it exists
                        if(log.id) delete log.id; // Let the DB auto-increment the ID to avoid conflicts
                        store.add(log);
                        importCount++;
                    });

                    transaction.oncomplete = () => {
                        const message = `Successfully imported ${importCount} log(s) and fuel types from "${filename}". The page will now reload.`;
                        console.log(message);
                        alert(message);
                        window.location.reload();
                    };

                    transaction.onerror = (event) => {
                        console.error("Error during data import:", event.target.error);
                        alert("An error occurred during import. Data may be partially imported.");
                    };
                };
                clearRequest.onerror = (event) => {
                     console.error("Error clearing object store:", event.target.error);
                     alert("Error clearing old data. Import aborted.");
                }
            }
        } catch (error) {
            console.error("Error parsing or processing import file:", error);
            alert(`Could not import data from "${filename}". Error: ${error.message}`);
        } finally {
            // Reset file input so the same file can be selected again
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

let activeCharts = {};

function destroyActiveCharts() {
    Object.values(activeCharts).forEach(chart => {
        if (chart) chart.destroy();
    });
    activeCharts = {};
}

async function loadAnalytics() {
    const allLogs = await getAllData('fuel_logs');
    const allVehicles = await getAllData('vehicles');

    if (allLogs.length < 1) {
        alert("No logs available to generate analytics.");
        return;
    }

    // Populate vehicle filter dropdown
    const vehicleFilterSelect = document.getElementById('analytics-vehicle-filter');
    vehicleFilterSelect.innerHTML = '<option value="all">All Vehicles</option>';
    allVehicles.forEach(v => {
        vehicleFilterSelect.innerHTML += `<option value="${v.id}">${v.name}</option>`;
    });

    const updateAnalyticsView = (selectedVehicleId) => {
        let logsToShow = allLogs;
        if (selectedVehicleId !== 'all') {
            logsToShow = allLogs.filter(log => log.vehicleId === parseInt(selectedVehicleId, 10));
        }

        if (logsToShow.length < 2 && selectedVehicleId !== 'all') {
            alert("Not enough data for this vehicle to generate analytics. Please add at least two fill-up logs with odometer readings for it.");
        }

        // Sort logs by date and then odometer to ensure correct order for calculations
        logsToShow.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA - dateB !== 0) return dateA - dateB;
            return a.odometer - b.odometer;
        });

        // Pass the full, sorted list of logs to the main analytics function
        const analyticsData = calculateAnalytics(logsToShow);

        // For the cost chart, we still want to filter out odo-only logs so they don't show up as 0 cost
        const logsForCostChart = logsToShow.filter(log => !(!log.totalCost && !log.price && !log.amount && log.odometer > 0));

        displayKeyMetrics(analyticsData);
        displayAnalyticsCharts(logsForCostChart, analyticsData); // Pass filtered logs to charts
        displayRecentLogs(logsToShow); // Show all logs in the "Recent Logs" list
    };

    // Initial view
    updateAnalyticsView('all');

    // Add event listener for changes
    vehicleFilterSelect.onchange = (e) => {
        updateAnalyticsView(e.target.value);
    };

    openModalWithAnimation(document.getElementById('analyticsModal'));
}

function calculateAnalytics(logs) {
    const metrics = {
        totalSpend: 0,
        totalAmount: 0,
        totalDistance: 0,
        efficiencyReadings: [],
        efficiencyDates: [],
        avgPrice: 0,
        avgEfficiency: 0,
    };

    if (logs.length === 0) return metrics;

    let totalSpendForAvg = 0;
    let totalAmountForAvg = 0;

    logs.forEach(log => {
        // Calculate total spend and amount from logs that are not odometer-only
        const isOdometerOnly = log.odometer > 0 && !log.totalCost && !log.price && !log.amount;
        if (!isOdometerOnly) {
            metrics.totalSpend += log.totalCost;
            metrics.totalAmount += log.amount;
        }

        // For average price, only use logs with a valid price.
        if (log.price > 0) {
            totalSpendForAvg += log.totalCost;
            totalAmountForAvg += log.amount;
        }
    });

    if (totalAmountForAvg > 0) {
        metrics.avgPrice = totalSpendForAvg / totalAmountForAvg;
    }

    // Calculate distance and efficiency using all logs sorted by date and odometer.
    const firstValidLogIndex = logs.findIndex(log => log.odometer > 0);

    if (firstValidLogIndex !== -1) {
        let lastOdometer = logs[firstValidLogIndex].odometer;

        for (let i = firstValidLogIndex + 1; i < logs.length; i++) {
            const currentLog = logs[i];

            if (currentLog.odometer > 0 && currentLog.odometer > lastOdometer) {
                const distance = currentLog.odometer - lastOdometer;
                metrics.totalDistance += distance;

                // Efficiency is based on the amount of the last fill-up.
                // We search backwards from the previous log to find the last time fuel was added.
                let fuelUsed = 0;
                for (let j = i - 1; j >= 0; j--) {
                    const prevLog = logs[j];
                    if (prevLog.amount > 0) {
                        fuelUsed = prevLog.amount;
                        break; // Found the last fill-up, stop searching.
                    }
                }

                if (fuelUsed > 0 && distance > 0) {
                    const efficiency = (fuelUsed / distance) * 100; // L/100km
                    metrics.efficiencyReadings.push(efficiency);
                    metrics.efficiencyDates.push(currentLog.date);
                }
            }
            // Update lastOdometer if the current log has a valid reading.
            if (currentLog.odometer > 0) {
                lastOdometer = currentLog.odometer;
            }
        }
    }

    if (metrics.efficiencyReadings.length > 0) {
        const sum = metrics.efficiencyReadings.reduce((a, b) => a + b, 0);
        metrics.avgEfficiency = sum / metrics.efficiencyReadings.length;
    }

    return metrics;
}

function displayKeyMetrics(metrics) {
    const container = document.getElementById('key-metrics-container');
    container.innerHTML = '';

    const createMetricBox = (label, value) => {
        const box = document.createElement('div');
        box.className = 'p-4 bg-gray-100 dark:bg-gray-700 rounded-lg';
        box.innerHTML = `<p class="font-bold text-lg">${value}</p><p class="text-sm text-gray-600 dark:text-gray-400">${label}</p>`;
        return box;
    };

    container.appendChild(createMetricBox('Total Spend', `$${metrics.totalSpend.toFixed(2)}`));
    container.appendChild(createMetricBox('Avg Price/L', `$${metrics.avgPrice.toFixed(3)}`));
    container.appendChild(createMetricBox('Avg Efficiency', `${metrics.avgEfficiency > 0 ? metrics.avgEfficiency.toFixed(2) : 'N/A'} L/100km`));
    container.appendChild(createMetricBox('Total Distance', `${metrics.totalDistance.toLocaleString()} km`));
}

function displayAnalyticsCharts(logs, metrics) {
    destroyActiveCharts();

    // Cost Over Time Chart
    const costCtx = document.getElementById('cost-over-time-chart').getContext('2d');
    const costData = {
        labels: logs.map(l => l.date),
        datasets: [{
            label: 'Total Cost ($)',
            data: logs.map(l => l.totalCost),
            borderColor: '#62D995',
            backgroundColor: 'rgba(98, 217, 149, 0.2)',
            fill: true,
            tension: 0.1
        }]
    };
    activeCharts.cost = new Chart(costCtx, {
        type: 'line',
        data: costData,
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Efficiency Chart
    const efficiencyCtx = document.getElementById('efficiency-chart').getContext('2d');
    const efficiencyData = {
        labels: metrics.efficiencyDates,
        datasets: [{
            label: 'Efficiency (L/100km)',
            data: metrics.efficiencyReadings,
            borderColor: '#80C7F2',
            backgroundColor: 'rgba(128, 199, 242, 0.2)',
            fill: true,
            tension: 0.1
        }]
    };
    activeCharts.efficiency = new Chart(efficiencyCtx, { type: 'line', data: efficiencyData });
}

function displayRecentLogs(logs) {
    const container = document.getElementById('recent-logs-container');
    container.innerHTML = '';
    const recentLogs = logs.slice(-5).reverse(); // Get last 5 logs, newest first

    recentLogs.forEach(log => {
        const logEl = document.createElement('div');
        logEl.className = 'p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm flex justify-between items-center';
        logEl.innerHTML = `
            <span>${log.date}</span>
            <span class="font-semibold">${log.fuelType}</span>
            <span>$${log.totalCost.toFixed(2)}</span>
            <span>${log.amount.toFixed(2)} L</span>
        `;
        container.appendChild(logEl);
    });
}


function addSwipeListeners(element, onSwipeLeft, onSwipeRight) {
    let touchstartX = 0;
    let touchendX = 0;
    const threshold = 100; // Increased threshold for better gesture distinction

    element.addEventListener('touchstart', (e) => {
        // Only track the first touch
        if (e.touches.length === 1) {
            touchstartX = e.touches[0].screenX;
        }
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
        // Ensure it's the end of the first touch
        if (touchstartX !== 0 && e.changedTouches.length === 1) {
            touchendX = e.changedTouches[0].screenX;
            const swipeDistance = touchendX - touchstartX;

            if (Math.abs(swipeDistance) >= threshold) {
                if (swipeDistance < 0) {
                    onSwipeLeft(); // Swiped left
                } else {
                    onSwipeRight(); // Swiped right
                }
            }
        }
        // Reset touchstartX after the gesture is handled
        touchstartX = 0;
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', initCalendar);

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);

        // Force an update check on every page load.
        registration.update();

        // Track updates to the service worker.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available; show a toast notification.
              showUpdateToast(registration);
            }
          });
        });
      }).catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });

      let refreshing;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
      });
    });
  }
}

function showUpdateToast(registration) {
  const toast = document.createElement('div');
  toast.id = 'update-toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = '#333';
  toast.style.color = 'white';
  toast.style.padding = '15px';
  toast.style.borderRadius = '5px';
  toast.style.zIndex = '1000';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.innerHTML = `
    <span style="margin-right: 15px;">A new version of the app is available.</span>
    <button id="update-button" style="background-color: #4CAF50; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;">
      Update
    </button>
  `;
  document.body.appendChild(toast);

  document.getElementById('update-button').addEventListener('click', () => {
    const worker = registration.waiting;
    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
    toast.style.display = 'none';
  });
}

registerServiceWorker();

'use strict';
//todo
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const inputEditWorkout = document.getElementById('edit__workout');
const logoMap = document.querySelector('.logo');

class Workout {
  date = new Date();
  //tworzymy unikalne id z daty. datę zamieniamy na string +'' i wycinamy 10 ostatnich cyfr
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  //ustawienie opisu treningu
  _setDescription() {
    //wstawienie takiego komantarza mówi prettierowi aby ignorował kolejną linię!!! :)
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    //min/km
    this.pace = (this.duration / this.distance).toFixed(1);
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    //km/h
    this.speed = (this.distance / (this.duration / 60)).toFixed(1);
    return this.speed;
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// application architecture
class App {
  #map;
  #mapZoomLevel = 15;
  #mapEvent;
  #workouts = [];
  constructor() {
    //get user position
    this._getPosition();

    //get data from local storage
    this._getLocalStorage();

    /////////////////////////////////////////////////
    //event handlers

    //eventlistener - this wskazuje na DOM, czyli na fomrularz, więc używamy bind aby zadeklarować this
    form.addEventListener('submit', this.formSubmit.bind(this));

    //event dla zmiany typu treningu
    inputType.addEventListener('change', this._toggleElevationField);

    //event klikania na trening aby wyśrodkować mapę
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    //kasowanie
    logoMap.addEventListener('click', this.reset);

    this.getWorkoutsList();
  }

  //pobieramy pozycję usera
  _getPosition() {
    //pierwsza funkcja pobiera geo lokalizacje
    //druga wyświetla błąd gdy ich nie pobierze
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  //używamy pozycję usera aby wczytać mapę
  _loadMap(position) {
    //używamy destructuring aby zapisać zmienną pod tą samą nazwą
    const { latitude } = position.coords;
    //wyżej lepszy sposób na zadeklarowanie takiej zmiennej z obiektu
    const longitude = position.coords.longitude;
    const coords = [latitude, longitude];

    //leaflet
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel); //pierwsze argumenty to latitude i longitude, a trzeci to zoom mapy.

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    //dajemy pin na mapie
    this.#map.on('click', this._showForm.bind(this));

    //renderujemy piny ćwiczeń na mapie
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  //pokazuje formularz
  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus(); //zaznaczamy kursor na pole input dystans
    inputDistance.style.backgroundColor = '';
    inputType.style.backgroundColor = '';
    inputCadence.style.backgroundColor = '';
    inputDuration.style.backgroundColor = '';
    inputElevation.style.backgroundColor = '';
  }

  //chowamy formularz treningu
  _hideForm() {
    //empty inputs
    inputEditWorkout.value =
      inputDistance.value =
      inputCadence.value =
      inputDuration.value =
      inputElevation.value =
        '';
    // inputType.style.removeP('backgroundColor');
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  //przełączamy między cycclingiem a bieganiem
  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  //zatwierdzenie formularza
  formSubmit(e) {
    if (inputEditWorkout.value === '') {
      this._newWorkout(e);
    } else {
      this._editWorkout(e, inputEditWorkout.value);
    }
  }

  //zmiana opisu treningu
  _changeWorkoutDescription(des, type) {
    des = des.split(' ');
    des[0] = `${type[0].toUpperCase()}${type.slice(1)}`;
    return des.join(' ');
  }

  //helper function - walidacja formularz
  _validInputs(...inputs) {
    return inputs.every(inp => Number.isFinite(inp));
  }
  //helper function - walidacja formularz
  _allPositive(...inputs) {
    return inputs.every(inp => inp > 0);
  }

  //nowe ćwieczenie
  _newWorkout(e) {
    //get data from form
    const type = inputType.value;
    const duration = +inputDuration.value;
    const distance = +inputDistance.value;

    const lat = this.#mapEvent.latlng.lat;
    const lng = this.#mapEvent.latlng.lng;
    let workout;

    //if workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      //chech valid data
      if (
        !this._validInputs(distance, duration, cadence) ||
        !this._allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    //if workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      //chech valid data
      if (
        !this._validInputs(distance, duration, elevation) ||
        !this._allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    //add new object to workout array
    this.#workouts.push(workout);

    //render workout on map as marker
    this._renderWorkoutMarker(workout);

    //render workout on list
    this._renderWorkout(workout);

    //getting delete and edit buttons
    this.getDeleteBtn();
    this.getEditBtn();

    //hide form + clear input fields
    this._hideForm();

    //set local storage to all workouts
    this._setLocalStorage();
  }

  //edytuj ćwiczenie
  _editWorkout(e, editId) {
    e.preventDefault();
    //get local data
    let data = JSON.parse(localStorage.getItem('workouts'));

    //find id workout
    data = data.map(item => {
      if (item.id === editId) {
        const type = inputType.value;
        const duration = +inputDuration.value;
        const distance = +inputDistance.value;

        if (type === 'running') {
          const cadence = +inputCadence.value;
          //chech valid data
          if (
            !this._validInputs(distance, duration, cadence) ||
            !this._allPositive(distance, duration, cadence)
          )
            return alert('Inputs have to be positive numbers');

          //wartości są zwalidowane
          item.type = type;
          item.duration = duration;
          item.cadence = cadence;
          item.distance = distance;
          item.pace = (item.duration / item.distance).toFixed(1);

          //prettier-ignore
          item.description = this._changeWorkoutDescription(item.description, type);
        }

        if (type === 'cycling') {
          const elevation = +inputElevation.value;
          //chech valid data
          if (
            !this._validInputs(distance, duration, elevation) ||
            !this._allPositive(distance, duration)
          )
            return alert('Inputs have to be positive numbers');

          //wartości są zwalidowane
          item.type = type;
          item.duration = duration;
          item.elevationGain = elevation;
          item.distance = distance;
          item.speed = (item.distance / (item.duration / 60)).toFixed(1);

          //prettier-ignore
          item.description = this._changeWorkoutDescription(item.description,type);
        }
      }
      localStorage.setItem('workouts', JSON.stringify(data));
      location.reload();
      return item;
    });

    //hide form + clear input fields
    this._hideForm();
  }
  //renderujemy na mapie marker
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  //wyświetlamy listę odbytych treningów na bocznym pasku
  _renderWorkout(workout) {
    let html = `
    <div class="wrapper">
    <div class="workout__edit hidden" data-id="${
      workout.id
    }" title="Edit workout"></div>

    <div class="workout__delete hidden" data-id="${
      workout.id
    }" title="Delete workout"></div>

      <li class="workout workout--${workout.type}" data-id="${
      workout.id
    }" title="${workout.id}">

        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
      `;

    if (workout.type === 'running')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
        </div>
        `;

    if (workout.type === 'cycling')
      html += `
            <div class="workout__details">
              <span class="workout__icon">⚡️</span>
              <span class="workout__value">${workout.speed}</span>
              <span class="workout__unit">km/h</span>
            </div>
            <div class="workout__details">
              <span class="workout__icon">⛰</span>
              <span class="workout__value">${workout.elevationGain}</span>
              <span class="workout__unit">m</span>
            </div>
          </li>
          </div>
          `;

    //wstawiamy workout do html, afterend wstawia element jako rodzeństwo
    form.insertAdjacentHTML('afterend', html);
  }

  //po kliknięciu w odnbyty trening centruje mapę na nim
  _moveToPopup(e) {
    //closest szuka roodzica klikniętego elementu i przyczepia do niego event
    const workoutEl = e.target.closest('.workout');

    //jeżeli klikniemy na null to wychodzimy z eventu
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    //metoda z leaflet
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  //zapisywanie ćwiczeń do pamięci przeglądarki
  _setLocalStorage() {
    //json.stringify - zamienia obiekt na string
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  //pobieramy dane z pamięci lokalnej
  _getLocalStorage() {
    //JSON.parse - zamienia string na obiekt
    const data = JSON.parse(localStorage.getItem('workouts'));
    //obiekty pobierane z local storage tracąa dziedziczenie prototypów!!!!!!!!!!!!!

    //nie ma danych - zakończ funkcję
    if (!data) return;

    this.#workouts = data;
    //renderujemy ćwiczenia na listę
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });

    this.getDeleteBtn();
    this.getEditBtn();
  }

  //pobieram guziki do usuwania
  getDeleteBtn() {
    let btnDeleteWorkout = document.querySelectorAll('.workout__delete');
    btnDeleteWorkout.forEach(btn =>
      btn.addEventListener('click', this.deleteWorkout.bind(this))
    );
  }

  //usuwamy workout
  deleteWorkout(e) {
    const delWorkId = e.target.dataset.id;
    let data = JSON.parse(localStorage.getItem('workouts'));

    data = data.filter(item => item.id !== delWorkId);

    localStorage.setItem('workouts', JSON.stringify(data));
    location.reload();
  }

  //pobieram guziki do edycji
  getEditBtn() {
    let btnEditWorkout = document.querySelectorAll('.workout__edit');
    btnEditWorkout.forEach(btn =>
      btn.addEventListener('click', this.editWorkout.bind(this))
    );
  }

  getWorkoutsList() {
    const cw = document.querySelectorAll('.wrapper');
    cw.forEach(cw => {
      cw.addEventListener('mouseenter', function (e) {
        const tagi = e.target;

        if (tagi.children[0] && tagi.children[0].classList.contains('workout__edit')) tagi.children[0].classList.remove('hidden');
        if (tagi.children[1] && tagi.children[1].classList.contains('workout__delete')) tagi.children[1].classList.remove('hidden');
      });
    });
    cw.forEach(cw => {
      cw.addEventListener('mouseleave', function (e) {
        const tagi = e.target;

        if (tagi.children[0] && tagi.children[0].classList.contains('workout__edit')) tagi.children[0].classList.add('hidden');
        if (tagi.children[1] && tagi.children[1].classList.contains('workout__delete')) tagi.children[1].classList.add('hidden');
      });
    });
  }
  //edytujemy workout - wyświetlanie formularza + zmiana kolorów tła input
  editWorkout(e) {
    const editWorkId = e.target.dataset.id;

    let data = JSON.parse(localStorage.getItem('workouts'));

    data = data.filter(item => item.id === editWorkId);

    //wyświetlanie workout do edycji
    if (editWorkId) {
      //show form
      form.classList.remove('hidden');

      if (data[0].type === 'running') {
        inputElevation.closest('.form__row').classList.add('form__row--hidden');
        inputCadence
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputCadence.value = data[0].cadence;
      }
      // workout__edit--bc
      if (data[0].type === 'cycling') {
        inputElevation
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputCadence.closest('.form__row').classList.add('form__row--hidden');
        inputElevation.classList.remove('form__row--hidden');
        inputElevation.value = data[0].elevationGain;
      }

      //upload value
      inputType.value = data[0].type;
      inputDistance.value = data[0].distance;
      inputDuration.value = data[0].duration;

      //add close button
      const html = `<div class="workout__close" title="Close"></div>`;

      form.insertAdjacentHTML('afterbegin', html);
      const btnCloseWorkout = document.querySelector('.workout__close');
      btnCloseWorkout.addEventListener('click', this._hideForm);
      inputEditWorkout.value = editWorkId;
    }
  }

  //usuwanie ćwiczeń z pamięci podręcznej
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

//tworzymy nowy obiekt z klasy App
const app = new App();

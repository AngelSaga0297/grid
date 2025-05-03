document.addEventListener('DOMContentLoaded', function() {
    // Seleccionar todos los divs dentro del contenedor parent
    const divs = document.querySelectorAll('.options-list div, .option');
    
    // Añadir event listener a cada div
    divs.forEach(div => {
      div.addEventListener('click', function(e) {
        // Detener la propagación para evitar múltiples alerts si se hace clic en un div anidado
        e.stopPropagation();
        
        // Obtener el texto del div o su clase si está vacío
        const divText = this.textContent.trim() || this.className;
        alert(`Se presionó: ${divText}`);
      });
    });
  });

document.querySelector('.search svg').addEventListener('click', function() {
    this.classList.add('clicked');
    setTimeout(() => {
        this.classList.remove('clicked');
    }, 300);
});

// Función para extraer metadatos de MP3
function getMP3Metadata(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            
            // Extraer duración
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContext.decodeAudioData(arrayBuffer.slice(0), function(buffer) {
                const duration = buffer.duration;
                
                // Intentar extraer imagen del álbum (si existe en los metadatos)
                let albumArt = null;
                try {
                    const tags = new ID3Reader(arrayBuffer);
                    tags.read();
                    if (tags.tags.picture) {
                        albumArt = URL.createObjectURL(new Blob([tags.tags.picture.data], {type: tags.tags.picture.format}));
                    }
                } catch(e) {
                    console.log("No se encontraron metadatos de imagen", e);
                }
                
                resolve({
                    duration: duration,
                    albumArt: albumArt
                });
            });
        };
        reader.readAsArrayBuffer(file);
    });
}

// ID3Reader simplificado para extraer metadatos
class ID3Reader {
    constructor(data) {
        this.data = data;
        this.tags = {};
    }
    
    read() {
        // Implementación básica para leer tags ID3
        // Esta es una versión simplificada que solo busca imágenes
        try {
            const str = String.fromCharCode.apply(null, new Uint8Array(this.data.slice(0, 10)));
            if (str.startsWith('ID3')) {
                this.parseID3(this.data);
            }
        } catch(e) {
            console.error("Error leyendo metadatos ID3", e);
        }
    }
    
    parseID3(data) {
        // Implementación simplificada del parser ID3
        // Solo busca el tag APIC (imagen del álbum)
        const view = new DataView(data);
        let offset = 10; // Saltar header ID3
        
        while (offset < view.byteLength) {
            const frameHeader = String.fromCharCode(
                view.getUint8(offset),
                view.getUint8(offset + 1),
                view.getUint8(offset + 2),
                view.getUint8(offset + 3)
            );
            
            if (frameHeader === 'APIC') {
                this.parseAPICFrame(view, offset);
                break;
            }
            
            offset += 10; // Saltar al siguiente frame
        }
    }
    
    parseAPICFrame(view, offset) {
        // Parsear frame APIC para obtener la imagen
        offset += 10; // Saltar frame header
        
        const encoding = view.getUint8(offset);
        offset += 1;
        
        // Saltar tipo MIME
        while (view.getUint8(offset) !== 0 && offset < view.byteLength) offset++;
        offset += 1;
        
        // Saltar tipo de imagen
        while (view.getUint8(offset) !== 0 && offset < view.byteLength) offset++;
        offset += 1;
        
        // Leer datos de la imagen
        const imageData = [];
        while (offset < view.byteLength) {
            imageData.push(view.getUint8(offset));
            offset += 1;
        }
        
        this.tags.picture = {
            data: new Uint8Array(imageData),
            format: 'image/jpeg' // Asumimos JPEG por simplicidad
        };
    }
}

// Manejador para la carga de archivos MP3
function addSongToPlaylist(file) {
    
    if(!file.name.endsWith('.mp3')){
        alert('Solo se permiten archivos MP3');
        return;
    }

    getMP3Metadata(file).then(metadata => {
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        
        const songName = file.name.replace('.mp3', '');
        
        songItem.innerHTML += `
            <div class="song-name">${songName}</div>
            <div class="song-duration">${formatDuration(metadata.duration)}</div>
        `;
        
        songItem.addEventListener('click', () => {
            playSong(file, {
                title: songName,
                artist: metadata.artist || "Artista Desconocido",
                albumArt: metadata.albumArt,
                duration: metadata.duration
            }, songItem);
        })
        
        document.getElementById('music-list').appendChild(songItem);

    }).catch(error => {
        console.error('Error procesando archivo MP3:', error);
    });
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Obtener el input de archivo
const fileInput = document.getElementById('mp3-upload');

// Escuchar cuando selecciones archivos
fileInput.addEventListener('change', function(e) {
    console.log('Archivos seleccionados:', e.target.files);
    // Iterar por cada archivo seleccionado
    Array.from(e.target.files).forEach(file => {
        addSongToPlaylist(file);
    });
});


// Variables globales para el reproductor
let currentAudio = null;
let currentSong = null;

// Función para reproducir una canción
function playSong(file, metadata) {
    // Detener la canción actual si hay una
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Crear nuevo objeto Audio
    const audioUrl = URL.createObjectURL(file);
    currentAudio = new Audio(audioUrl);
    currentSong = {
        file: file,
        metadata: metadata
    };

    // Actualizar la UI del reproductor
    updatePlayerUI(metadata);

    // Reproducir la canción
    currentAudio.play();
}

// Función para actualizar la UI del reproductor
function updatePlayerUI(metadata) {
    const player = document.querySelector('.music-player');
    
    // Actualizar información de la canción
    player.querySelector('.song-title').textContent = metadata.title || 'Canción Desconocida';
    player.querySelector('.artist').textContent = metadata.artist || 'Artista Desconocido';
    
    // Actualizar imagen del álbum si existe
    const albumArt = player.querySelector('.album-art-placeholder');
    if (metadata.albumArt) {
        albumArt.innerHTML = '';
        const img = document.createElement('img');
        img.src = metadata.albumArt;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '50%';
        albumArt.appendChild(img);
    } else {
        albumArt.innerHTML = '🎵';
        albumArt.style.fontSize = '24px';
    }
    
    // Actualizar controles
    const playBtn = player.querySelector('.play');
    playBtn.textContent = '⏸';
}

// Modificar el manejador de carga de archivos para incluir más metadatos
document.getElementById('mp3-upload').addEventListener('change', async function(e) {
    const files = e.target.files;
    const musicList = document.getElementById('music-list');
    musicList.innerHTML = '';
    
    for (let file of files) {
        if (!file.name.endsWith('.mp3')) continue;
        
        try {
            const metadata = await getMP3Metadata(file);
            const songName = file.name.replace('.mp3', '');
            
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            
            // Agregar evento de clic para reproducir
            songItem.addEventListener('click', () => playSong(file, {
                title: songName,
                artist: 'Artista Desconocido',
                albumArt: metadata.albumArt,
                duration: metadata.duration
            }));
            
            // Resto del código para crear la lista de canciones...
            // ... (mantener el código existente para crear los elementos del DOM)
            
            musicList.appendChild(songItem);
        } catch (error) {
            console.error('Error procesando archivo MP3:', error);
        }
    }
});

// Controladores para los botones del reproductor
document.querySelector('.play').addEventListener('click', function() {
    if (currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play();
            this.textContent = '⏸';
        } else {
            currentAudio.pause();
            this.textContent = '▶';
        }
    }
});

document.querySelector('.prev').addEventListener('click', function() {
    // Implementar lógica para canción anterior
    console.log('Canción anterior');
});

document.querySelector('.next').addEventListener('click', function() {
    // Implementar lógica para canción siguiente
    console.log('Canción siguiente');
});

// Función para actualizar la progress bar
function updateProgressBar() {
    if (!currentAudio) return;
    
    const progressBar = document.querySelector('.progress-bar');
    const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
    progressBar.style.width = `${progress}%`;
    
    if (!currentAudio.paused) {
        requestAnimationFrame(updateProgressBar);
    }
}

// Modificar la función playSong
function playSong(file, metadata, songItem) {
    if (currentAudio) {
        currentAudio.pause();
        document.querySelector('.song-item.playing')?.classList.remove('playing');
    }

    const audioUrl = URL.createObjectURL(file);
    currentAudio = new Audio(audioUrl);
    currentSong = { file, metadata, songItem };

    updatePlayerUI(metadata);
    songItem.classList.add('playing');
    
    currentAudio.addEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('ended', () => {
        songItem.classList.remove('playing');
    });

    currentAudio.play();
}

// Modificar el event listener para la carga de archivos
document.getElementById('mp3-upload').addEventListener('change', async function(e) {
    const files = e.target.files;
    const musicList = document.getElementById('music-list');
    musicList.innerHTML = '';
    
    for (let file of files) {
        if (!file.name.endsWith('.mp3')) continue;
        
        try {
            const metadata = await getMP3Metadata(file);
            const songName = file.name.replace('.mp3', '');
            
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            
            songItem.addEventListener('click', (e) => {
                if (e.target !== songItem && !e.target.classList.contains('song-name')) return;
                playSong(file, {
                    title: songName,
                    artist: 'Artista Desconocido',
                    albumArt: metadata.albumArt,
                    duration: metadata.duration
                }, songItem);
            });
            
            // Resto del código para crear la lista de canciones...
            musicList.appendChild(songItem);
        } catch (error) {
            console.error('Error procesando archivo MP3:', error);
        }
    }
});
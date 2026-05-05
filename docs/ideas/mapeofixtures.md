1. Open Fixture Library (OFL) — La joya de la corona
Es el equivalente a Wikipedia para librerías de luces. Es un proyecto de código abierto donde la comunidad mapea de todo, desde el foco chino más barato hasta el último modelo de Clay Paky.

Por qué te interesa: Sus librerías ya están en JSON.

API/Source: Tienen un repositorio en GitHub inmenso y una API donde puedes consultar por fabricante y modelo.

Tu jugada: Podrías crear un pequeño "Translator" en Aether que lea el esquema de OFL y lo convierta automáticamente a tu formato JSON de la Forja.

2. GDTF Share (General Device Type Format) — El estándar profesional
GDTF es un formato creado por gigantes como MA Lighting y Robe para que exista un único archivo universal para todas las consolas y visualizadores.

Web: gdtf-share.com

Por qué te interesa: Es lo que usan ahora los profesionales. Casi todos los fabricantes nuevos suben sus archivos oficiales aquí.

El reto: El formato .gdtf es en realidad un archivo comprimido (zip) que contiene un XML con la lógica y archivos 3D/GLB. Requiere un poco más de trabajo de parseo que el JSON de OFL, pero es el futuro.

3. Carallon / DMX Library
Existen bases de datos comerciales como Carallon (que es la que usan consolas como Pharos o Brompton), pero suelen ser cerradas y de pago. No te las recomiendo para un proyecto independiente a menos que quieras quemar billetes.

Mi recomendación de "Arquitecto":
Yo tiraría de cabeza a por Open Fixture Library (OFL).

Te descargas su repositorio completo (es texto plano).

Mapeas sus tipos de canales (ej: su Intensity a tu Dimmer).

Haces que tu "Forja" tenga un botón de "Importar de OFL".

De esta forma, pasas de tener 0 librerías a tener más de 3.000 fixtures disponibles al instante sin haber movido un dedo.
# EL ORIGEN — documento de producción

## Premisa

Volvés al departamento de tu abuela por un trámite aparentemente simple: juntar papeles, verificar el estado de la casa y dejar encaminada una tasación. La familia habla de cuidado, sucesión y urgencia. La casa responde con otra versión: durante años, el afecto fue usado como método para aislar propietarios, administrar su cansancio y comprar viviendas por debajo de su valor.

El terror no nace de un monstruo externo. Nace de una pregunta doméstica: ¿qué pasa cuando una casa entiende el método con el que intentaron abaratarla?

## Tesis jugable

- El trámite es el tutorial.
- La libreta es el decodificador.
- El plano convierte la casa en tablero.
- El sensor convierte al jugador en variable económica.
- La tasación final no mide metros: mide docilidad.

## Mapa actual

- Entrada: sobre de la tasadora y puerta de la abuela.
- Pasillo: distribución principal y foto intervenida.
- Living: televisión ficticia de 1986, radio, carpeta de tasación.
- Cocina: heladera preparada, carpeta, sopera, azulejo y libreta.
- Dormitorio: carpeta de sucesión, llaves y prueba afectiva.
- Pasillo de servicio: plano bajo pintura, sensor de conducta y panel falso.
- Hueco: archivo, pared escrita y decisión de exposición.

## Finales

1. Ceder: firmar la tasación baja.
2. Resistir: rechazar el precio y dejar constancia.
3. Exponer: armar archivo con libreta, plano, sensor y tasación.
4. Despertar: sólo aparece después de una partida terminada; la casa pasa de escenario a tablero vivo.

## Dirección visual

Horror doméstico argentino, ilustración oscura pero legible, textura de tinta, luz cálida enferma, humedad y objetos con función narrativa. Todos los fondos principales usan 1536×1024 para evitar recortes por mezcla de ratios.

## Riesgos removidos

- Sin referencias al juego anterior.
- Sin nombres retirados.
- Sin marcas reales ni logos.
- Sin uso de personajes, deportes, franquicias o tableros protegidos.
- La señal de 1986 es ficticia y funciona como lenguaje mecánico propio.

## QA mínimo de build

- Tests de motor narrativo.
- Tests de dimensiones reales de PNG contra escenas.
- Tests de contaminación por nombres/marcas/IP retiradas.
- Build Next/Vercel sin `outputDirectory: out`.

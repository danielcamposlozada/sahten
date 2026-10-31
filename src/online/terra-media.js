// Recursos propios de Sahten. Vite entrega este módulo como chunk separado:
// no se descarga ni ocupa memoria hasta publicar un sitio Terra con videos.
// ?inline evita rutas del bundler que no existen en la web estática exportada.
// No importar desde el checkout ni desde el sitio del cliente.
import celebrarMp4 from '../../media/terra/tabla-celebrar.mp4?inline';
import compartirMp4 from '../../media/terra/tabla-compartir.mp4?inline';
import supermixMp4 from '../../media/terra/supermix.mp4?inline';
import tutorialMp4 from '../../media/terra/como-comprar.mp4?inline';
import celebrarPoster from '../../media/terra/posters/tabla-celebrar.webp?inline';
import compartirPoster from '../../media/terra/posters/tabla-compartir.webp?inline';
import supermixPoster from '../../media/terra/posters/supermix.webp?inline';
import tutorialPoster from '../../media/terra/posters/como-comprar.webp?inline';

export const TERRA_MEDIA_ASSETS = [
  ['media/terra/tabla-celebrar.mp4', celebrarMp4],
  ['media/terra/tabla-compartir.mp4', compartirMp4],
  ['media/terra/supermix.mp4', supermixMp4],
  ['media/terra/como-comprar.mp4', tutorialMp4],
  ['media/terra/posters/tabla-celebrar.webp', celebrarPoster],
  ['media/terra/posters/tabla-compartir.webp', compartirPoster],
  ['media/terra/posters/supermix.webp', supermixPoster],
  ['media/terra/posters/como-comprar.webp', tutorialPoster],
];

// Fotografías originales de Sahten entregadas por el dueño el 31/10/2026.
// Esta importación es diferida: solo se empaquetan al publicar el diseño Terra.
// ?inline genera data URL sin intentar servir assets desde el host de la app.
import plato from '../../media/terra/photos/banner-plato.webp?inline';
import tortas from '../../media/terra/photos/banner-tortas.webp?inline';
import catering from '../../media/terra/photos/catering-mesa.webp?inline';

export const TERRA_PHOTO_ASSETS = [
  ['media/terra/photos/banner-plato.webp', plato],
  ['media/terra/photos/banner-tortas.webp', tortas],
  ['media/terra/photos/catering-mesa.webp', catering],
];
